From Stdlib Require Import List Bool Arith Lia.
Require Import Ownership.
Import ListNotations.

(* The caller supplies surviving candidates in policy order, with local prefix
   inputs and classifications. This model does not construct that stack. *)
Record candidate := Candidate {
  candidate_id : nat;
  candidate_frame : frame;
  candidate_boundary : boundary;
  candidate_boundary_column : nat;
  candidate_rule : prefix_rule;
  candidate_input : list prefix_token;
  candidate_column : nat;
  candidate_interrupts : bool;
  candidate_sibling : bool
}.

Definition candidate_result (claim : option nat) (c : candidate) :=
  select_frame (candidate_id c) (candidate_frame c) (candidate_boundary c)
    (candidate_boundary_column c) (candidate_rule c) (candidate_input c)
    (candidate_column c) claim (candidate_interrupts c) (candidate_sibling c).

Fixpoint scan_candidates (claim : option nat) (stack : list candidate) : option nat :=
  match stack with
  | [] => None
  | c :: rest => match candidate_result claim c with
    | Some owner => Some owner
    | None => scan_candidates claim rest
    end
  end.

Fixpoint selection_visits (claim : option nat) (stack : list candidate) : nat :=
  match stack with
  | [] => 0
  | c :: rest => match candidate_result claim c with
    | Some _ => 1
    | None => S (selection_visits claim rest)
    end
  end.

Theorem singleton_claim_names_frame : forall claim interrupts id f owner,
  eligible_claim claim interrupts [(id, f)] = Some owner -> owner = id.
Proof.
  intros [claimed|] interrupts id f owner H; simpl in H; [|discriminate].
  destruct (negb interrupts && ((Nat.eqb claimed id && container_open f) || false)) eqn:E;
    [|discriminate].
  inversion H; subst owner.
  apply andb_true_iff in E; destruct E as [_ E].
  rewrite orb_false_r in E. apply andb_true_iff in E; destruct E as [E _].
  now apply Nat.eqb_eq in E.
Qed.

Theorem selected_candidate_is_open : forall claim c owner,
  candidate_result claim c = Some owner ->
  owner = candidate_id c /\ container_open (candidate_frame c) = true.
Proof.
  intros claim c owner H; unfold candidate_result, select_frame in H.
  destruct (container_open (candidate_frame c)) eqn:Hopen; [|discriminate].
  split; [|reflexivity].
  destruct (consume_prefix (candidate_rule c) (candidate_input c));
    [inversion H; reflexivity|].
  destruct (candidate_sibling c); [discriminate|].
  destruct (eligible_claim claim (candidate_interrupts c)
    [(candidate_id c, candidate_frame c)]) eqn:Hclaim.
  - inversion H; subst. now apply singleton_claim_names_frame in Hclaim.
  - destruct (fallback_owns (candidate_boundary c) (candidate_boundary_column c)
      (candidate_column c) (candidate_interrupts c) (candidate_frame c));
      inversion H; reflexivity.
Qed.

Theorem stack_selection_is_live : forall claim stack owner,
  scan_candidates claim stack = Some owner ->
  exists c, In c stack /\ candidate_id c = owner /\
    container_open (candidate_frame c) = true.
Proof.
  intros claim stack; induction stack as [|c rest IH]; intros owner H;
    simpl in H; [discriminate|].
  destruct (candidate_result claim c) eqn:Hresult.
  - inversion H; subst. apply selected_candidate_is_open in Hresult.
    destruct Hresult as [Hid Hopen]. exists c.
    split; [left; reflexivity|]. split; [symmetry; exact Hid|exact Hopen].
  - apply IH in H. destruct H as [found [Hin [Hid Hopen]]].
    exists found. split; [right; exact Hin|]. split; assumption.
Qed.

Theorem first_accepted_candidate_wins : forall claim c rest owner,
  candidate_result claim c = Some owner ->
  scan_candidates claim (c :: rest) = Some owner.
Proof. intros claim c rest owner H; simpl; now rewrite H. Qed.

Theorem closed_candidate_is_skipped : forall claim c rest,
  container_open (candidate_frame c) = false ->
  scan_candidates claim (c :: rest) = scan_candidates claim rest.
Proof.
  intros claim c rest H; simpl; unfold candidate_result.
  rewrite closed_frame_cannot_be_selected; auto.
Qed.

Theorem candidate_selection_append : forall claim prefix suffix,
  scan_candidates claim (prefix ++ suffix) =
    match scan_candidates claim prefix with
    | Some owner => Some owner
    | None => scan_candidates claim suffix
    end.
Proof.
  intros claim prefix; induction prefix as [|c rest IH]; intros suffix; simpl; [reflexivity|].
  destruct (candidate_result claim c); [reflexivity|exact (IH suffix)].
Qed.

Theorem selection_visits_bounded : forall claim stack,
  selection_visits claim stack <= length stack.
Proof.
  intros claim stack; induction stack as [|c rest IH]; simpl; [lia|].
  destruct (candidate_result claim c); lia.
Qed.

Definition candidate_frames (stack : list candidate) : list (nat * frame) :=
  map (fun c => (candidate_id c, candidate_frame c)) stack.

Definition prefix_result (c : candidate) : option nat :=
  if container_open (candidate_frame c) then
    match consume_prefix (candidate_rule c) (candidate_input c) with
    | Some _ => Some (candidate_id c)
    | None => None
    end
  else None.

Fixpoint prefix_owner (stack : list candidate) : option nat :=
  match stack with
  | [] => None
  | c :: rest => match prefix_result c with
    | Some owner => Some owner
    | None => prefix_owner rest
    end
  end.

Definition claimable (c : candidate) : bool :=
  negb (candidate_interrupts c) && negb (candidate_sibling c).

Definition claim_frames (stack : list candidate) :=
  candidate_frames (filter claimable stack).

Definition select_candidates (claim : option nat) (stack : list candidate) : option nat :=
  match prefix_owner stack with
  | Some owner => Some owner
  | None => match eligible_claim claim false (claim_frames stack) with
    | Some owner => Some owner
    | None => scan_candidates None stack
    end
  end.

Theorem explicit_prefix_wins : forall claim stack owner,
  prefix_owner stack = Some owner ->
  select_candidates claim stack = Some owner.
Proof. intros claim stack owner H; unfold select_candidates; now rewrite H. Qed.

Theorem live_stack_claim_wins : forall id stack,
  prefix_owner stack = None ->
  live_owner id (claim_frames stack) = true ->
  select_candidates (Some id) stack = Some id.
Proof.
  intros id stack Hprefix Hlive. unfold select_candidates.
  rewrite Hprefix, claim_selects_live_owner; auto.
Qed.

Theorem rejected_stack_claim_uses_scan : forall claim stack,
  prefix_owner stack = None ->
  eligible_claim claim false (claim_frames stack) = None ->
  select_candidates claim stack = scan_candidates None stack.
Proof. intros claim stack Hprefix Hclaim; unfold select_candidates; now rewrite Hprefix, Hclaim. Qed.

Theorem failed_scan_visits_every_candidate : forall claim stack,
  scan_candidates claim stack = None -> selection_visits claim stack = length stack.
Proof.
  intros claim stack; induction stack as [|c rest IH]; intros H; simpl in *; [reflexivity|].
  destruct (candidate_result claim c) eqn:Hresult; [discriminate|].
  now rewrite IH.
Qed.

Theorem successful_scan_has_first_witness : forall claim stack owner,
  scan_candidates claim stack = Some owner ->
  exists prefix c suffix,
    stack = prefix ++ c :: suffix /\
    Forall (fun before => candidate_result claim before = None) prefix /\
    candidate_result claim c = Some owner /\
    selection_visits claim stack = length prefix + 1.
Proof.
  intros claim stack; induction stack as [|head rest IH]; intros owner H; simpl in H; [discriminate|].
  destruct (candidate_result claim head) eqn:Hresult.
  - inversion H; subst. exists [], head, rest. simpl.
    split; [reflexivity|]. split; [constructor|]. split; [exact Hresult|].
    simpl. now rewrite Hresult.
  - apply IH in H. destruct H as [prefix [c [suffix [Hstack [Hall [Haccept Hvisits]]]]]].
    exists (head :: prefix), c, suffix. simpl.
    split; [now rewrite Hstack|]. split; [constructor; assumption|].
    split; [exact Haccept|]. simpl. rewrite Hresult, Hvisits. lia.
Qed.

Theorem live_candidate_witness : forall id stack,
  live_owner id (candidate_frames stack) = true ->
  exists c, In c stack /\ candidate_id c = id /\
    container_open (candidate_frame c) = true.
Proof.
  intros id stack; induction stack as [|c rest IH]; intros H; simpl in H; [discriminate|].
  apply orb_true_iff in H. destruct H as [H|H].
  - apply andb_true_iff in H. destruct H as [Hid Hopen].
    apply Nat.eqb_eq in Hid. exists c.
    split; [left; reflexivity|]. split; [symmetry; exact Hid|exact Hopen].
  - apply IH in H. destruct H as [found [Hin [Hid Hopen]]].
    exists found. split; [right; exact Hin|]. split; assumption.
Qed.

Theorem prefix_selection_is_live : forall stack owner,
  prefix_owner stack = Some owner ->
  exists c, In c stack /\ candidate_id c = owner /\
    container_open (candidate_frame c) = true.
Proof.
  intros stack; induction stack as [|c rest IH]; intros owner H; simpl in H; [discriminate|].
  destruct (prefix_result c) eqn:Hprefix.
  - inversion H; subst. unfold prefix_result in Hprefix.
    destruct (container_open (candidate_frame c)) eqn:Hopen; [|discriminate].
    destruct (consume_prefix (candidate_rule c) (candidate_input c)); [|discriminate].
    inversion Hprefix; subst. exists c.
    split; [left; reflexivity|]. split; [reflexivity|exact Hopen].
  - apply IH in H. destruct H as [found [Hin [Hid Hopen]]].
    exists found. split; [right; exact Hin|]. split; assumption.
Qed.

Theorem global_selection_is_live : forall claim stack owner,
  select_candidates claim stack = Some owner ->
  exists c, In c stack /\ candidate_id c = owner /\
    container_open (candidate_frame c) = true.
Proof.
  intros claim stack owner H. unfold select_candidates in H.
  destruct (prefix_owner stack) eqn:Hprefix.
  - inversion H; subst. now apply prefix_selection_is_live in Hprefix.
  - destruct claim as [id|].
    + unfold eligible_claim in H. simpl in H.
      destruct (live_owner id (claim_frames stack)) eqn:Hlive.
      * inversion H; subst. unfold claim_frames in Hlive.
        apply live_candidate_witness in Hlive.
        destruct Hlive as [found [Hin [Hid Hopen]]].
        apply filter_In in Hin. destruct Hin as [Hin _].
        exists found. split; [exact Hin|]. split; assumption.
      * now apply stack_selection_is_live in H.
    + unfold eligible_claim in H. now apply stack_selection_is_live in H.
Qed.
