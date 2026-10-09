use carve::{BlockNode, Document};
use serde_json::{json, Value};
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::io::{self, Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering::Relaxed};
use std::time::{Duration, Instant};

struct CountingAllocator;
static ENABLED: AtomicBool = AtomicBool::new(false);
static BYTES: AtomicU64 = AtomicU64::new(0);
static CALLS: AtomicU64 = AtomicU64::new(0);
fn record(size: usize) {
    if ENABLED.load(Relaxed) {
        BYTES.fetch_add(size as u64, Relaxed);
        CALLS.fetch_add(1, Relaxed);
    }
}
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let p = System.alloc(layout);
        if !p.is_null() {
            record(layout.size());
        }
        p
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        let p = System.alloc_zeroed(layout);
        if !p.is_null() {
            record(layout.size());
        }
        p
    }
    unsafe fn realloc(&self, p: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        let p = System.realloc(p, layout, size);
        if !p.is_null() {
            record(size);
        }
        p
    }
    unsafe fn dealloc(&self, p: *mut u8, layout: Layout) {
        System.dealloc(p, layout);
    }
}
#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

fn cpu_ms() -> f64 {
    let mut t = libc::timespec {
        tv_sec: 0,
        tv_nsec: 0,
    };
    assert_eq!(
        unsafe { libc::clock_gettime(libc::CLOCK_PROCESS_CPUTIME_ID, &mut t) },
        0
    );
    t.tv_sec as f64 * 1000.0 + t.tv_nsec as f64 / 1_000_000.0
}
fn depth(nodes: &[BlockNode], quotes: bool) -> usize {
    nodes
        .iter()
        .map(|n| match n {
            BlockNode::BlockQuote(q) => usize::from(quotes) + depth(&q.children, quotes),
            BlockNode::List(l) => {
                usize::from(!quotes)
                    + l.items
                        .iter()
                        .map(|i| depth(&i.children, quotes))
                        .max()
                        .unwrap_or(0)
            }
            _ => 0,
        })
        .max()
        .unwrap_or(0)
}
fn once(mode: &str, source: &str, doc: &Option<Document>) {
    match mode {
        "parse" => {
            black_box(carve::parse(black_box(source)));
        }
        "render" => {
            black_box(carve::render_html(black_box(doc.as_ref().unwrap())).unwrap());
        }
        "html" => {
            black_box(carve::to_html(black_box(source)));
        }
        _ => panic!("Unknown phase"),
    }
}
fn emit(v: Value) {
    println!("{v}");
    io::stdout().flush().unwrap();
}
fn main() {
    let mut input = String::new();
    io::stdin().read_to_string(&mut input).unwrap();
    let task: Value = serde_json::from_str(&input).unwrap();
    let mode = task["mode"].as_str().unwrap();
    let family = task["family"].as_str().unwrap();
    for row in task["cases"].as_array().unwrap() {
        let size = row["size"].as_u64().unwrap();
        let source = row["source"].as_str().unwrap();
        emit(json!({"event":"start", "size":size, "bytes":source.len()}));
        let parsed = carve::parse(source);
        let actual_depth = if family.starts_with("nested-") {
            Some(depth(&parsed.children, family == "nested-quotes"))
        } else {
            None
        };
        if actual_depth.is_some_and(|d| d != size as usize) {
            emit(
                json!({"event":"result", "status":"error", "size":size, "bytes":source.len(), "error":format!("Requested depth {size}, parsed {}", actual_depth.unwrap())}),
            );
            continue;
        }
        let expected = match carve::render_html(&parsed) {
            Ok(html) => html,
            Err(error) => {
                emit(
                    json!({"event":"result", "status":"error", "size":size, "bytes":source.len(), "error":error.to_string()}),
                );
                continue;
            }
        };
        if carve::to_html(source) != expected {
            emit(
                json!({"event":"result", "status":"error", "size":size, "bytes":source.len(), "error":"Combined HTML differs from parse/render"}),
            );
            continue;
        }
        let doc = if mode == "render" {
            Some(parsed)
        } else {
            drop(parsed);
            None
        };
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(200) {
            once(mode, source, &doc);
        }
        let (mut wall, mut cpu, mut iterations) = (Vec::new(), Vec::new(), Vec::new());
        for _ in 0..5 {
            let c = cpu_ms();
            let start = Instant::now();
            let mut n = 0;
            loop {
                once(mode, source, &doc);
                n += 1;
                if start.elapsed() >= Duration::from_millis(20) {
                    break;
                }
            }
            wall.push(start.elapsed().as_secs_f64() * 1000.0 / n as f64);
            cpu.push((cpu_ms() - c) / n as f64);
            iterations.push(n);
        }
        let (mut bytes, mut calls) = (Vec::new(), Vec::new());
        for _ in 0..5 {
            BYTES.store(0, Relaxed);
            CALLS.store(0, Relaxed);
            ENABLED.store(true, Relaxed);
            once(mode, source, &doc);
            ENABLED.store(false, Relaxed);
            bytes.push(BYTES.load(Relaxed));
            calls.push(CALLS.load(Relaxed));
        }
        emit(
            json!({"event":"result", "status":"ok", "size":size, "bytes":source.len(), "depth":actual_depth,
            "samplesMs":wall, "samplesCpuMs":cpu, "batchIterations":iterations,
            "samplesAllocatedBytes":bytes, "samplesAllocationCalls":calls, "htmlBytes":expected.len()}),
        );
    }
}
