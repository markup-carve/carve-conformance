use carve::{BlockNode, Document};
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::time::{Duration, Instant};

struct Counter;
static ENABLED: AtomicBool = AtomicBool::new(false);
static BYTES: AtomicU64 = AtomicU64::new(0);
static CALLS: AtomicU64 = AtomicU64::new(0);

fn record(size: usize) {
    if ENABLED.load(Relaxed) {
        BYTES.fetch_add(size as u64, Relaxed);
        CALLS.fetch_add(1, Relaxed);
    }
}

unsafe impl GlobalAlloc for Counter {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let pointer = System.alloc(layout);
        if !pointer.is_null() {
            record(layout.size());
        }
        pointer
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        let pointer = System.alloc_zeroed(layout);
        if !pointer.is_null() {
            record(layout.size());
        }
        pointer
    }
    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        let pointer = System.realloc(pointer, layout, size);
        if !pointer.is_null() {
            record(size);
        }
        pointer
    }
    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        System.dealloc(pointer, layout);
    }
}

#[global_allocator]
static ALLOCATOR: Counter = Counter;

fn depth(nodes: &[BlockNode], quote: bool) -> usize {
    nodes
        .iter()
        .map(|node| match node {
            BlockNode::BlockQuote(block) => usize::from(quote) + depth(&block.children, quote),
            BlockNode::List(block) => {
                usize::from(!quote)
                    + block
                        .items
                        .iter()
                        .map(|item| depth(&item.children, quote))
                        .max()
                        .unwrap_or(0)
            }
            _ => 0,
        })
        .max()
        .unwrap_or(0)
}

fn run(phase: &str, source: &str, document: &Document) {
    match phase {
        "parse" => {
            black_box(carve::parse(black_box(source)));
        }
        "render" => {
            black_box(carve::render_html(black_box(document)).unwrap());
        }
        "html" => {
            black_box(carve::to_html(black_box(source)));
        }
        _ => panic!("Unknown phase"),
    }
}

fn main() {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).is_some_and(|arg| arg == "--html") {
        let marker = match args[2].as_str() {
            "quote" => "> ",
            "list" => "- ",
            _ => panic!("Unknown family"),
        };
        let size: usize = args[3].parse().unwrap();
        print!(
            "{}",
            carve::to_html(&format!("{}end\n", marker.repeat(size)))
        );
        return;
    }
    assert_eq!(
        args.len(),
        1,
        "Use no arguments, or --html quote|list DEPTH"
    );
    for (family, marker) in [("quote", "> "), ("list", "- ")] {
        for size in [48, 96, 192] {
            let source = format!("{}end\n", marker.repeat(size));
            let document = carve::parse(&source);
            assert_eq!(depth(&document.children, family == "quote"), size);
            let expected = carve::render_html(&document).unwrap();
            assert_eq!(carve::to_html(&source), expected);
            for phase in ["parse", "render", "html"] {
                let start = Instant::now();
                while start.elapsed() < Duration::from_millis(200) {
                    run(phase, &source, &document);
                }
                let mut timings = Vec::new();
                let mut iterations = Vec::new();
                for _ in 0..5 {
                    let start = Instant::now();
                    let mut count = 0_u32;
                    loop {
                        run(phase, &source, &document);
                        count += 1;
                        if start.elapsed() >= Duration::from_millis(20) {
                            break;
                        }
                    }
                    timings.push(start.elapsed().as_secs_f64() * 1000.0 / f64::from(count));
                    iterations.push(count);
                }
                let mut bytes = Vec::new();
                let mut calls = Vec::new();
                for _ in 0..5 {
                    BYTES.store(0, Relaxed);
                    CALLS.store(0, Relaxed);
                    ENABLED.store(true, Relaxed);
                    run(phase, &source, &document);
                    ENABLED.store(false, Relaxed);
                    bytes.push(BYTES.load(Relaxed));
                    calls.push(CALLS.load(Relaxed));
                }
                assert_eq!(carve::render_html(&document).unwrap(), expected);
                assert_eq!(carve::to_html(&source), expected);
                println!(
                    "{{\"family\":\"{family}\",\"depth\":{size},\"phase\":\"{phase}\",\
                    \"inputBytes\":{},\"htmlBytes\":{},\"samplesMs\":{timings:?},\
                    \"batchIterations\":{iterations:?},\"samplesAllocatedBytes\":{bytes:?},\
                    \"samplesAllocationCalls\":{calls:?}}}",
                    source.len(),
                    expected.len()
                );
            }
        }
    }
}
