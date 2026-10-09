From Stdlib Require Import String List Ascii.
From DjotV Require Import Invariants Step Ast Config Marker Line Inline Strings.
Import ListNotations.
Open Scope string_scope.

Definition interruption := with_marker_interrupts prose_safe_markers djot_bconfig.

Example interruption_is_sublist : interruption = sublist_bconfig.
Proof. reflexivity. Qed.

Example wrapped_input_conditions :
  classify "alpha" = KText /\ forallb nonblank ["- beta"] = true.
Proof. split; reflexivity. Qed.

Example default_wrap_condition : wrap_neutral djot_bconfig.
Proof. exact djot_wrap_neutral. Qed.

Example interruption_loses_wrap_condition : ~ wrap_neutral interruption.
Proof.
  intros [H _].
  specialize (H [SBullet "-"%char] "" None "beta").
  vm_compute in H. discriminate H.
Qed.

Example interruption_keeps_incremental : forall T, block_incremental T interruption.
Proof. intro T. apply block_incremental_holds. Qed.

Example default_wrapped_blocks :
  List.length (@parse_blocks djot_table djot_bconfig _ _ "alpha
- beta
") = 1.
Proof. vm_compute. reflexivity. Qed.

Example interruption_unwrapped_blocks :
  List.length (@parse_blocks djot_table interruption _ _ "alpha - beta
") = 1.
Proof. vm_compute. reflexivity. Qed.

Example interruption_wrapped_blocks :
  List.length (@parse_blocks djot_table interruption _ _ "alpha
- beta
") = 2.
Proof. vm_compute. reflexivity. Qed.

Print Assumptions default_wrapped_blocks.
Print Assumptions interruption_unwrapped_blocks.
Print Assumptions interruption_wrapped_blocks.
Print Assumptions default_wrap_condition.
Print Assumptions interruption_loses_wrap_condition.
Print Assumptions interruption_keeps_incremental.

Print Assumptions interruption_is_sublist.
Print Assumptions wrapped_input_conditions.
