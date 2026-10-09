From Coq Require Import List Bool Arith Lia.
Import ListNotations.

(* CARVE-P0-003, after prefix decoding and opaque-body handling.
   Inputs are classified boundaries, not source text. *)
Inductive boundary :=
| ordinary | blank | line_comment | fenced_comment | definition | heading
| quote | code_fence | raw_fence | colon_fence | table
| nested_list | continuation | end_input.

Inductive container := Quote | ListItem | DefinitionBody | FootnoteBody.

Record frame := Frame {
  kind : container;
  base_column : nat;
  content_column : nat;
  container_open : bool;
  paragraph_open : bool
}.

Definition boundary_state (b : boundary) (deepest : bool) : bool * bool :=
  match b with
  | ordinary => (true, true)
  | quote | nested_list | continuation => (true, deepest)
  | end_input => (false, false)
  | _ => (true, false)
  end.

Definition step (f : frame) (event : boundary * bool) : frame :=
  let '(c, p) := boundary_state (fst event) (snd event) in
  Frame (kind f) (base_column f) (content_column f)
    (container_open f && c) (container_open f && p).

Definition set_paragraph (p : bool) (f : frame) : frame :=
  Frame (kind f) (base_column f) (content_column f) (container_open f) p.

(* The column-only branch of the owner table. The caller has already ruled
   out a stored continuation claim. The stack is innermost first; None names
   the document. Frame identifiers distinguish nested containers of one kind.
   Well-formed frames have base_column < content_column. *)
Definition owns_column (column : nat) (f : frame) : bool :=
  container_open f && Nat.ltb (base_column f) column.

Fixpoint column_owner (column : nat) (stack : list (nat * frame)) : option nat :=
  match stack with
  | [] => None
  | (id, f) :: rest =>
      if owns_column column f then Some id else column_owner column rest
  end.

Fixpoint run (f : frame) (events : list (boundary * bool)) : frame :=
  match events with
  | [] => f
  | event :: rest => run (step f event) rest
  end.

Theorem boundary_keeps_container : forall f b deepest,
  container_open f = true -> b <> end_input ->
  container_open (step f (b, deepest)) = true.
Proof.
  intros f b deepest Hopen Hboundary.
  destruct b; simpl; rewrite Hopen; simpl; congruence.
Qed.

Theorem comment_closes_only_paragraph : forall f deepest,
  container_open f = true ->
  container_open (step f (line_comment, deepest)) = true /\
  paragraph_open (step f (line_comment, deepest)) = false /\
  container_open (step f (fenced_comment, deepest)) = true /\
  paragraph_open (step f (fenced_comment, deepest)) = false.
Proof.
  intros f deepest Hopen; simpl; rewrite Hopen; repeat split; reflexivity.
Qed.

Theorem closed_frame_stays_closed : forall f event,
  container_open f = false ->
  container_open (step f event) = false /\
  paragraph_open (step f event) = false.
Proof.
  intros f [b deepest] Hclosed.
  destruct b; simpl; rewrite Hclosed; split; reflexivity.
Qed.

(* Uniformity of this boundary operation, not of full container parsing. *)
Theorem boundary_uniformity : forall k1 k2 base content c p event,
  let f1 := step (Frame k1 base content c p) event in
  let f2 := step (Frame k2 base content c p) event in
  container_open f1 = container_open f2 /\
  paragraph_open f1 = paragraph_open f2.
Proof.
  intros k1 k2 base content c p [b deepest].
  destruct b; split; reflexivity.
Qed.

Theorem owner_ignores_paragraph : forall column stack p,
  column_owner column
    (map (fun entry => (fst entry, set_paragraph p (snd entry))) stack) =
  column_owner column stack.
Proof.
  intros column stack; induction stack as [| [id f] rest IH]; intros p.
  - reflexivity.
  - change
      ((if owns_column column f then Some id else
          column_owner column
            (map (fun entry => (fst entry, set_paragraph p (snd entry))) rest)) =
       (if owns_column column f then Some id else column_owner column rest)).
    rewrite IH. reflexivity.
Qed.

Theorem at_or_below_base_selects_ancestor : forall id f rest column,
  column <= base_column f ->
  column_owner column ((id, f) :: rest) = column_owner column rest.
Proof.
  intros id f rest column H.
  assert (Nat.ltb (base_column f) column = false) as E
    by (apply Nat.ltb_ge; exact H).
  simpl. unfold owns_column. rewrite E, andb_false_r. reflexivity.
Qed.

Theorem past_base_selects_innermost : forall id f rest column,
  container_open f = true -> base_column f < column ->
  column_owner column ((id, f) :: rest) = Some id.
Proof.
  intros id f rest column Hopen Hcolumn.
  assert (Nat.ltb (base_column f) column = true) as E
    by (apply Nat.ltb_lt; exact Hcolumn).
  simpl. unfold owns_column. rewrite Hopen, E. reflexivity.
Qed.

Theorem content_column_selects_innermost : forall id f rest column,
  container_open f = true ->
  base_column f < content_column f -> content_column f <= column ->
  column_owner column ((id, f) :: rest) = Some id.
Proof.
  intros id f rest column Hopen Hbase Hcontent.
  apply past_base_selects_innermost; [exact Hopen | lia].
Qed.

Theorem run_append : forall prefix f suffix,
  run f (prefix ++ suffix) = run (run f prefix) suffix.
Proof.
  induction prefix as [|event rest IH]; intros f suffix; simpl.
  - reflexivity.
  - apply IH.
Qed.

Theorem same_state_same_suffix : forall prefix1 prefix2 f1 f2 suffix,
  run f1 prefix1 = run f2 prefix2 ->
  run f1 (prefix1 ++ suffix) = run f2 (prefix2 ++ suffix).
Proof.
  intros prefix1 prefix2 f1 f2 suffix H.
  rewrite !run_append, H. reflexivity.
Qed.

Theorem end_input_absorbs : forall events f deepest,
  run (step f (end_input, deepest)) events = step f (end_input, deepest).
Proof.
  assert (Hclosed : forall events k base content,
    run (Frame k base content false false) events = Frame k base content false false).
  { induction events as [| [b child] rest IH]; intros k base content.
    - reflexivity.
    - destruct b; simpl; apply IH. }
  intros events [k base content c p] deepest.
  unfold step. simpl. repeat rewrite andb_false_r. apply Hclosed.
Qed.

(* Prefix tokens are measured columns: tabs have already been expanded in the
   leading whitespace run. Text is opaque to this prefix-only decoder. *)
Inductive prefix_token := Space | Greater | Text.
Inductive prefix_rule := Indent (width : nat) | QuotePrefix.

Fixpoint consume_indent (width : nat) (input : list prefix_token)
  : option (list prefix_token) :=
  match width, input with
  | 0, _ => Some input
  | S n, Space :: rest => consume_indent n rest
  | _, _ => None
  end.

Definition consume_prefix (rule : prefix_rule) (input : list prefix_token)
  : option (list prefix_token) :=
  match rule with
  | Indent n => consume_indent n input
  | QuotePrefix => match input with
    | [Greater] => Some []
    | Greater :: Space :: rest => Some rest
    | _ => None
    end
  end.

(* S1 walks outermost first and stops at the first missing prefix. *)
Fixpoint match_prefixes (rules : list prefix_rule) (input : list prefix_token)
  : nat * list prefix_token :=
  match rules with
  | [] => (0, input)
  | rule :: rest => match consume_prefix rule input with
    | None => (0, input)
    | Some residue => let '(count, tail) := match_prefixes rest residue in
                      (S count, tail)
    end
  end.

Definition claim_after (b : boundary) (owner : option nat) : option nat :=
  match b with ordinary => owner | _ => None end.

Fixpoint live_owner (id : nat) (stack : list (nat * frame)) : bool :=
  match stack with
  | [] => false
  | (candidate, f) :: rest =>
      (Nat.eqb id candidate && container_open f) || live_owner id rest
  end.

Definition eligible_claim (claim : option nat) (interrupts : bool)
  (stack : list (nat * frame)) : option nat :=
  match claim with
  | Some id => if negb interrupts && live_owner id stack then Some id else None
  | None => None
  end.

(* List-specific precedence: C3 and P9-051/053 govern these two boundaries.
   Other boundaries retain the Part 0 column branch. *)
Definition owns_after (previous : boundary) (boundary_column column : nat) (f : frame) : bool :=
  match kind f, previous with
  | ListItem, blank => container_open f && Nat.leb (content_column f) column
  | ListItem, line_comment => container_open f &&
      ((Nat.leb (base_column f) boundary_column && Nat.ltb boundary_column (content_column f))
       || Nat.leb (content_column f) column)
  | _, _ => owns_column column f
  end.

Definition fallback_owns (previous : boundary) (boundary_column column : nat)
  (interrupts : bool) (f : frame) : bool :=
  match kind f with
  | Quote => false
  | ListItem => if interrupts then
      container_open f && Nat.leb (content_column f) column
      else owns_after previous boundary_column column f
  | _ => owns_after previous boundary_column column f
  end.

(* A single surviving frame, with its local prefix and local authored column.
   Interrupt classification and comment/fence recognition remain external. *)
Definition select_frame (id : nat) (f : frame) (previous : boundary) (boundary_column : nat)
  (rule : prefix_rule) (input : list prefix_token) (column : nat)
  (claim : option nat) (interrupts sibling : bool) : option nat :=
  if container_open f then
    match consume_prefix rule input with
    | Some _ => Some id
    | None => if sibling then None else match eligible_claim claim interrupts [(id, f)] with
      | Some owner => Some owner
      | None => if fallback_owns previous boundary_column column interrupts f then Some id else None
      end
    end
  else None.

Theorem indent_consumes_exactly : forall n tail,
  consume_indent n (repeat Space n ++ tail) = Some tail.
Proof. induction n; intros tail; simpl; auto. Qed.

Theorem indent_success_reconstructs : forall n input tail,
  consume_indent n input = Some tail -> input = repeat Space n ++ tail.
Proof.
  induction n; intros input tail H; simpl in *.
  - inversion H; reflexivity.
  - destruct input as [|token rest]; try discriminate.
    destruct token; try discriminate. simpl. f_equal. now apply IHn.
Qed.

Theorem prefix_failure_stops : forall rule rest input,
  consume_prefix rule input = None -> match_prefixes (rule :: rest) input = (0, input).
Proof. intros rule rest input H; simpl; now rewrite H. Qed.

Theorem prefix_count_bounded : forall rules input,
  fst (match_prefixes rules input) <= length rules.
Proof.
  induction rules as [|rule rest IH]; intros input; simpl; [lia|].
  destruct (consume_prefix rule input) as [residue|]; simpl; [|lia].
  specialize (IH residue). destruct (match_prefixes rest residue); simpl in *; lia.
Qed.

Theorem ordinary_stores_owner : forall owner, claim_after ordinary owner = owner.
Proof. reflexivity. Qed.

Theorem boundary_clears_claim : forall b owner,
  b <> ordinary -> claim_after b owner = None.
Proof. intros b owner H; destruct b; simpl; congruence. Qed.

Theorem interrupt_rejects_claim : forall claim stack,
  eligible_claim claim true stack = None.
Proof. intros [id|] stack; reflexivity. Qed.

Theorem stale_claim_rejected : forall id stack interrupts,
  live_owner id stack = false -> eligible_claim (Some id) interrupts stack = None.
Proof. intros id stack interrupts H; unfold eligible_claim; rewrite H, andb_false_r; reflexivity. Qed.

Theorem claim_selects_live_owner : forall id stack,
  live_owner id stack = true -> eligible_claim (Some id) false stack = Some id.
Proof. intros id stack H; unfold eligible_claim; now rewrite H. Qed.

Theorem post_blank_item_requires_content : forall base content p boundary_column column,
  owns_after blank boundary_column column (Frame ListItem base content true p) = true <-> content <= column.
Proof. intros; simpl; apply Nat.leb_le. Qed.

Theorem line_comment_retains_item : forall base content p boundary_column column,
  base <= boundary_column -> boundary_column < content ->
  owns_after line_comment boundary_column column (Frame ListItem base content true p) = true.
Proof. intros base content p boundary_column column Hbase H.
  change (((Nat.leb base boundary_column && Nat.ltb boundary_column content) || Nat.leb content column) = true).
  apply Nat.ltb_lt in H; apply Nat.leb_le in Hbase; now rewrite Hbase, H. Qed.

Theorem closed_frame_cannot_be_selected : forall id f b boundary_column rule input column claim interrupts sibling,
  container_open f = false ->
  select_frame id f b boundary_column rule input column claim interrupts sibling = None.
Proof. intros id f b boundary_column rule input column claim interrupts sibling H; unfold select_frame; now rewrite H. Qed.

Theorem matched_prefix_selects_frame : forall id f b boundary_column rule input residue column claim interrupts sibling,
  container_open f = true -> consume_prefix rule input = Some residue ->
  select_frame id f b boundary_column rule input column claim interrupts sibling = Some id.
Proof. intros id f b boundary_column rule input residue column claim interrupts sibling Hopen Hprefix.
  unfold select_frame; now rewrite Hopen, Hprefix. Qed.


(* Source classification decides whether the boundary belongs to this frame.
   A boundary outside it closes the frame before applying any internal row. *)
Definition owned_step (f : frame) (event : boundary * bool) (inside : bool) : frame :=
  if inside then step f event else step f (end_input, false).

Theorem outside_boundary_closes_frame : forall f event,
  container_open (owned_step f event false) = false.
Proof. intros; simpl; apply andb_false_r. Qed.

Theorem retained_comment_selects_item : forall id base content p boundary_column column input,
  base <= boundary_column -> boundary_column < content ->
  select_frame id (Frame ListItem base content true p) line_comment boundary_column
    (Indent (content - base)) input column None false false = Some id.
Proof.
  intros id base content p boundary_column column input Hbase Hcontent.
  unfold select_frame.
  destruct (consume_prefix (Indent (content - base)) input); [reflexivity|].
  change ((if owns_after line_comment boundary_column column
    (Frame ListItem base content true p) then Some id else None) = Some id).
  rewrite line_comment_retains_item; auto.
Qed.
