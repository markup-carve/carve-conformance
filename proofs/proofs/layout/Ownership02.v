From Coq Require Import List Bool Arith.
Import ListNotations.

(* Carve 0.2 ownership of the lines below a list item whose marker stands at
   column m and whose marker line opened a paragraph (spec/0.2
   syntax-blocks.md, C2-B-012 to C2-B-025, C2-B-137, C2-B-138).
   Inputs are classified lines, not source text. *)
Inductive line :=
(* Paragraph text, or a heading, quote, attribute line or definition: none of
   them interrupts a paragraph (C2-B-024). *)
| Text (column : nat)
| Blank
(* A comment-only line (C2-B-137). *)
| Comment (column : nat)
(* A table row or a thematic break (C2-B-019, C2-B-200). *)
| Interrupter (column : nat)
(* A bare run of three or more percent signs (C2-B-108 to C2-B-110). *)
| CommentFence (column : nat)
(* A list marker at the list's column (C2-B-015). *)
| SiblingMarker.

Record state := State {
  item_open : bool;
  paragraph_open : bool;
  comment_body_open : bool
}.

Definition initial : state := State true true false.

(* C2-B-025: with no paragraph open, the item owns a line indented past its
   marker, measured from the marker's own column. *)
Definition owns (m column : nat) : bool := Nat.ltb m column.

Definition step (m : nat) (s : state) (l : line) : state :=
  if comment_body_open s then
    match l with
    | CommentFence _ => State (item_open s) false false
    | _ => s
    end
  else
    match l with
    | Comment _ => s
    | Blank => State (item_open s) false false
    | Text column =>
        if paragraph_open s then s
        else State (item_open s && owns m column) true false
    | Interrupter column => State (item_open s && owns m column) false false
    | CommentFence column => State (item_open s && owns m column) false true
    | SiblingMarker => State false true false
    end.

Fixpoint run (m : nat) (s : state) (ls : list line) : state :=
  match ls with
  | [] => s
  | l :: rest => run m (step m s l) rest
  end.

Inductive verdict := InItem | Outside | InComment.

(* Where the follower line ends up: in the item, outside it, or inside an
   open comment body, which takes its own closer too (C2-B-109). A sibling
   marker starts the next item. *)
Definition owner (m : nat) (s : state) (follower : line) : verdict :=
  if comment_body_open s then InComment
  else match follower with
  | SiblingMarker => Outside
  | _ => if item_open (step m s follower) then InItem else Outside
  end.

Definition is_comment (l : line) : bool :=
  match l with Comment _ => true | _ => false end.

Definition is_fence (l : line) : bool :=
  match l with CommentFence _ => true | _ => false end.

Theorem comment_line_unseen : forall m s c,
  step m s (Comment c) = s.
Proof. intros m [i p o] c. destruct o; reflexivity. Qed.

Theorem comment_lines_unseen : forall m ls s,
  run m s (filter (fun l => negb (is_comment l)) ls) = run m s ls.
Proof.
  intros m ls. induction ls as [| l rest IH]; intros s; [reflexivity |].
  destruct l; simpl; try apply IH.
  rewrite comment_line_unseen. apply IH.
Qed.

Corollary comment_lines_keep_owner : forall m ls s f,
  owner m (run m s (filter (fun l => negb (is_comment l)) ls)) f =
  owner m (run m s ls) f.
Proof. intros. rewrite comment_lines_unseen. reflexivity. Qed.

Theorem lazy_line_any_column : forall m s c,
  comment_body_open s = false -> item_open s = true -> paragraph_open s = true ->
  owner m s (Text c) = InItem.
Proof.
  intros m [i p o] c Ho Hi Hp. simpl in *. subst. reflexivity.
Qed.

Theorem unparagraphed_line_by_marker_column : forall m s c,
  comment_body_open s = false -> item_open s = true -> paragraph_open s = false ->
  owner m s (Text c) = if owns m c then InItem else Outside.
Proof.
  intros m [i p o] c Ho Hi Hp. simpl in *. subst. unfold owner, step. simpl.
  destruct (owns m c); reflexivity.
Qed.

Theorem interrupter_by_marker_column : forall m s c,
  comment_body_open s = false -> item_open s = true ->
  owner m s (Interrupter c) = if owns m c then InItem else Outside.
Proof.
  intros m [i p o] c Ho Hi. simpl in *. subst. unfold owner, step. simpl.
  destruct (owns m c); reflexivity.
Qed.

Theorem blank_closes_paragraph : forall m s,
  comment_body_open s = false -> paragraph_open (step m s Blank) = false.
Proof. intros m [i p o] Ho. simpl in *. subst. reflexivity. Qed.

Theorem closed_item_stays_closed : forall m ls s,
  item_open s = false -> item_open (run m s ls) = false.
Proof.
  intros m ls. induction ls as [| l rest IH]; intros [i p o] Hi;
    simpl in *; [assumption |].
  subst. apply IH. destruct o, l; try destruct p; reflexivity.
Qed.

Theorem unclosed_comment_fence_takes_the_rest : forall m ls s f,
  comment_body_open s = true -> forallb (fun l => negb (is_fence l)) ls = true ->
  owner m (run m s ls) f = InComment.
Proof.
  intros m ls. induction ls as [| l rest IH]; intros [i p o] f Ho Hn;
    simpl in *; subst.
  - reflexivity.
  - apply andb_true_iff in Hn as [Hl Hrest].
    destruct l; simpl in Hl; try discriminate; apply IH; auto.
Qed.

Theorem comment_fence_closes_unowning_item : forall m s c,
  comment_body_open s = false -> owns m c = false ->
  item_open (step m s (CommentFence c)) = false.
Proof.
  intros m [i p o] c Ho Hc. simpl in Ho. subst.
  cbn [step comment_body_open item_open]. rewrite Hc. apply andb_false_r.
Qed.
