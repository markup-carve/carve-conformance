let () =
  try while true do
    let length = int_of_string (input_line stdin) in
    if length < 0 || length > 1048576 then failwith "Invalid input length";
    let source = really_input_string stdin length in
    let html = Djot.Html.of_doc (Djot.Doc.of_string source) in
    Printf.printf "%d\n%s" (String.length html) html
  done with End_of_file -> ()
