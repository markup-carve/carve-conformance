open Djot.Kernel
let rec blocks xs = "[" ^ String.concat "," (List.map block xs) ^ "]"
and block (Ast.Node (_,_,b)) = match b with
  | Ast.Para _ -> "\"paragraph\""
  | Ast.CodeBlock _ -> "\"code_block\""
  | Ast.BlockQuote xs -> "{\"quote\":" ^ blocks xs ^ "}"
  | Ast.BulletList (_,items) -> "{\"bullet_list\":[" ^ String.concat "," (List.map blocks items) ^ "]}"
  | Ast.OrderedList (style,_,items) -> "{\"ordered_list\":[" ^ String.concat "," (List.map blocks items) ^ "],\"start\":" ^ string_of_int style.Ast.ol_start ^ "}"
  | _ -> failwith "Unsupported block in extension fixtures"
let () =
  let config = match Sys.argv.(1) with
    | "djot" -> Step.djot_bconfig
    | "list-interruption" -> Step.with_marker_interrupts Step.prose_safe_markers Step.djot_bconfig
    | _ -> failwith "Unknown configuration"
  in
  let input = Buffer.create 128 in
  (try while true do Buffer.add_channel input stdin 1 done with End_of_file -> ());
  let tree = Step.parse_blocks Profile.djot_profile.profile_inline config Step.semantic_line_ix Ast.semantic_pos (Buffer.contents input) in
  print_endline (blocks tree)
