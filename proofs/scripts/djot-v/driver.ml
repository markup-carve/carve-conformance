open Djot
let json_string s =
  let b = Buffer.create (String.length s + 2) in
  Buffer.add_char b '"';
  String.iter (fun c -> match c with
    | '"' -> Buffer.add_string b "\\\""
    | '\\' -> Buffer.add_string b "\\\\"
    | c when Char.code c < 32 -> Buffer.add_string b (Printf.sprintf "\\u%04x" (Char.code c))
    | c -> Buffer.add_char b c) s;
  Buffer.add_char b '"'; Buffer.contents b
let obj fields = "{" ^ String.concat "," (List.map (fun (k,v) -> json_string k ^ ":" ^ v) fields) ^ "}"
let arr f xs = "[" ^ String.concat "," (List.map f xs) ^ "]"
let node tag fields attrs = obj (("tag", json_string tag) :: fields @ (if attrs = [] then [] else ["attributes", obj (List.map (fun (k,v) -> k,json_string v) attrs)]))
let rec inline (Node (_,attrs,i)) =
  let kids tag xs = node tag ["children", arr inline xs] attrs in
  match i with
  | Inline.Str s -> node "str" ["text", json_string s] attrs
  | Inline.Emph xs -> kids "emph" xs
  | Inline.Strong xs -> kids "strong" xs
  | Inline.Verbatim s -> node "verbatim" ["text", json_string s] attrs
  | Inline.SoftBreak -> node "soft_break" [] attrs
  | Inline.HardBreak -> node "hard_break" [] attrs
  | Inline.Link (xs,t) | Inline.Image (xs,t) ->
    let tag = match i with Inline.Link _ -> "link" | _ -> "image" in
    let target = match t with Inline.Direct s -> "destination", json_string s | Inline.Reference s -> "reference", json_string s in
    node tag ["children", arr inline xs; target] attrs
  | _ -> failwith "Unsupported inline in comparison adapter"
let rec block (Node (_,attrs,b)) =
  let kids tag xs = node tag ["children", arr block xs] attrs in
  let items xs = arr (fun bs -> node "list_item" ["children", arr block bs] []) xs in
  let tight = function Block.Tight -> "true" | Block.Loose -> "false" in
  match b with
  | Block.Para xs -> node "para" ["children", arr inline xs] attrs
  | Block.Heading (level,xs) -> node "heading" ["level", string_of_int level; "children", arr inline xs] attrs
  | Block.Section xs -> kids "section" xs
  | Block.BlockQuote xs -> kids "blockquote" xs
  | Block.CodeBlock (lang,text) -> node "code_block" ["lang", json_string lang; "text", json_string text] attrs
  | Block.BulletList (spacing,xs) -> node "bullet_list" ["tight", tight spacing; "children", items xs] attrs
  | Block.OrderedList (style,spacing,xs) -> node "ordered_list" ["start", string_of_int style.ol_start; "tight", tight spacing; "children", items xs] attrs
  | Block.RefDef (label,destination) -> obj ["type", json_string "link_reference_definition"; "label", json_string label; "href", json_string destination]
  | Block.ThematicBreak -> node "thematic_break" [] attrs
  | _ -> failwith "Unsupported block in comparison adapter"
let read_input () =
  let b = Buffer.create 1024 in
  (try while true do Buffer.add_channel b stdin 1 done with End_of_file -> ()); Buffer.contents b
let clock () = Unix.gettimeofday ()
let cpu () = let t = Unix.times () in t.Unix.tms_utime +. t.Unix.tms_stime
let sink = ref 0
let benchmark phase source =
  let doc = Doc.of_string source in
  let run () = match phase with
    | "parse" -> let d = Doc.of_string source in sink := !sink lxor List.length (Doc.blocks d)
    | "render" -> sink := !sink lxor String.length (Html.of_doc doc)
    | "html" -> sink := !sink lxor String.length (Html.of_doc (Doc.of_string source))
    | _ -> failwith "Unknown benchmark phase"
  in
  let warm_end = clock () +. 0.2 in while clock () < warm_end do run () done;
  let samples = List.init 5 (fun _ ->
    Gc.full_major ();
    let start = clock () and start_cpu = cpu () and before = Gc.allocated_bytes () in
    let iterations = ref 0 in
    while !iterations = 0 || clock () -. start < 0.02 do
      for _ = 1 to 16 do run (); incr iterations done
    done;
    let wall = clock () -. start and used_cpu = cpu () -. start_cpu and bytes = Gc.allocated_bytes () -. before in
    let n = float_of_int !iterations in
    obj ["iterations", string_of_int !iterations; "wallMs", Printf.sprintf "%.9g" (wall *. 1000. /. n);
      "cpuMs", Printf.sprintf "%.9g" (used_cpu *. 1000. /. n); "allocatedBytes", Printf.sprintf "%.9g" (bytes /. n)]) in
  obj ["phase", json_string phase; "samples", "[" ^ String.concat "," samples ^ "]"; "sink", string_of_int !sink]
let config = Kernel.Profile.djot_profile
let raw_parse source = Kernel.Step.parse_blocks config.profile_inline config.profile_block Kernel.Step.semantic_line_ix Kernel.Ast.semantic_pos source
let doc_json bs = node "doc" ["children", arr block bs] []
let stream source suffix =
  let xs = Kernel.Strings.split_lines source and ys = Kernel.Strings.split_lines suffix in
  let initial = Kernel.Step.PPara [] in
  let committed,state = Kernel.Uniformity.run_lines config.profile_inline config.profile_block xs initial in
  let parse_lines ls st = Kernel.Step.parse_lines config.profile_inline config.profile_block Kernel.Step.semantic_line_ix Kernel.Ast.semantic_pos ls st in
  obj ["committed", arr block committed; "prefixFinished", arr block (parse_lines xs initial);
    "whole", arr block (parse_lines (xs @ ys) initial); "resumed", arr block (committed @ parse_lines ys state)]
let () =
  let source = read_input () in
  let output = match Sys.argv.(1) with
    | "observe" -> let doc = Doc.of_string source in
      obj ["document", doc_json (Doc.blocks doc); "kernel", doc_json (raw_parse source); "html", json_string (Html.of_doc doc)]
    | "stream" -> stream source Sys.argv.(2)
    | "benchmark" -> benchmark Sys.argv.(2) source
    | "html" -> obj ["html", json_string (Html.of_doc (Doc.of_string source))]
    | _ -> failwith "Unknown command"
  in print_endline output
