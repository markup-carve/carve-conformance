From Stdlib Require Import String List.
From DjotV Require Import Ast Inline Step.
Import ListNotations.
Open Scope string_scope.

Definition parse_default (s : string) :=
  @parse_blocks djot_table djot_bconfig semantic_line_ix semantic_pos s.

Example lazy_line_stays_in_footnote :
  match parse_default "[^n]: a
b
" with
  | [Node _ _ (FootnoteDef "n" _)] => True
  | _ => False
  end.
Proof. vm_compute. exact I. Qed.

Example indented_line_stays_in_footnote :
  match parse_default "[^n]: a
 b
" with
  | [Node _ _ (FootnoteDef "n" _)] => True
  | _ => False
  end.
Proof. vm_compute. exact I. Qed.

Example lazy_and_indented_content_agree :
  parse_default "[^n]: a
b
" = parse_default "[^n]: a
 b
".
Proof. vm_compute. reflexivity. Qed.

Example blank_ends_lazy_footnote :
  match parse_default "[^n]: a

b
" with
  | [Node _ _ (FootnoteDef "n" _); Node _ _ (Para _)] => True
  | _ => False
  end.
Proof. vm_compute. exact I. Qed.

Print Assumptions lazy_line_stays_in_footnote.
Print Assumptions indented_line_stays_in_footnote.
Print Assumptions lazy_and_indented_content_agree.
Print Assumptions blank_ends_lazy_footnote.
