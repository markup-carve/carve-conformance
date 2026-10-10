"""Export historical observations with units and source metadata."""
import csv
import json
from pathlib import Path
from statistics import median
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '_site' / 'charts'
OUT.mkdir(parents=True, exist_ok=True)
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'svg.fonttype': 'none'})
COLORS = ['#126c68', '#c95730', '#6154a4', '#ad7d19', '#477ba8']
charts = []

def export(dataset, family, phase, metric, unit, series, metadata, note):
    slug = '-'.join([dataset, family, phase, metric])
    load = metadata.get('loadStart', metadata.get('loadAverage'))
    if load:
        note += f" Recorded host load: {load}; logical CPUs: {metadata.get('logicalCpus', 'not recorded')}."
    depth = 'nested' in family or dataset in ['profile', 'profile-js', 'prefix-change', 'tail-change', 'container-tails']
    cached_points = [dict(reader=reader, **r) for reader, rows in series.items() for r in rows]
    record = dict(id=slug, dataset=dataset, family=family, phase=phase, metric=metric, unit=unit, xUnit='depth' if depth else 'bytes', points=cached_points, metadata=metadata, note=note)
    cached = OUT / f'{slug}.json'
    if cached.exists() and {k: v for k, v in json.loads(cached.read_text()).items() if k != 'note'} == {k: v for k, v in record.items() if k != 'note'} and all((OUT / f'{slug}.{ext}').exists() for ext in ['svg', 'png', 'csv']):
        cached.write_text(json.dumps(record))
        charts.append(record)
        return
    fig, ax = plt.subplots(figsize=(8.4, 7.2 if dataset == 'current-costs' and len(series) > 5 else 5.2), layout='constrained')
    variant_colors = {reader.split(' / round ')[0]: COLORS[index % len(COLORS)] for index, reader in enumerate(dict.fromkeys(reader.split(' / round ')[0] for reader in series))}
    points = []
    for index, (reader, rows) in enumerate(series.items()):
        valid = [r for r in rows if r['value'] is not None]
        if valid:
            if dataset == 'current-costs':
                point = valid[0]
                ax.barh(reader, point['value'], xerr=[[point['value'] - point['low']], [point['high'] - point['value']]], color=variant_colors[reader.split(' / round ')[0]], capsize=3)
            else:
                ax.plot([r['x'] for r in valid], [r['value'] for r in valid], 'o', label=reader, color=variant_colors[reader.split(' / round ')[0]], linestyle='--' if reader.endswith(' / round 2') else '-', linewidth=1.8, markersize=4)
                ax.fill_between([r['x'] for r in valid], [r['low'] for r in valid], [r['high'] for r in valid], color=variant_colors[reader.split(' / round ')[0]], alpha=.10)
        points.extend(dict(reader=reader, **r) for r in rows)
    depth = 'nested' in family or dataset in ['profile', 'profile-js', 'prefix-change', 'tail-change', 'container-tails']
    if dataset == 'current-costs':
        ax.set(xlabel=unit, title=f'{family} · {phase} · {metric}')
        ax.set_xlim(left=0)
    else:
        ax.set(xlabel='Nesting depth' if depth else 'Input bytes', ylabel=unit, title=f'{family} · {phase} · {metric}')
        ax.set_ylim(bottom=0)
    ax.grid(alpha=.18)
    ax.spines[['top', 'right']].set_visible(False)
    if ax.lines and dataset != 'current-costs':
        ax.legend(frameon=False)
    date = metadata.get('generatedAt', 'date not recorded')
    fig.supxlabel(f'{dataset} | {date}\nHistorical observations; see accompanying JSON for pins and method.', fontsize=8)
    for extension in ['svg', 'png']:
        fig.savefig(OUT / f'{slug}.{extension}', dpi=160)
    plt.close(fig)
    with (OUT / f'{slug}.csv').open('w') as file:
        writer = csv.DictWriter(file, fieldnames=['reader', 'x', 'value', 'low', 'high', 'status'])
        writer.writeheader()
        writer.writerows(points)
    record = dict(id=slug, dataset=dataset, family=family, phase=phase, metric=metric, unit=unit, xUnit='depth' if depth else 'bytes', points=points, metadata=metadata, note=note)
    (OUT / f'{slug}.json').write_text(json.dumps(record))
    charts.append(record)

def observation(row, samples, depth):
    valid = row.get('status', 'ok') == 'ok' and bool(samples)
    return dict(x=row['size'] if depth else row['bytes'], value=median(samples) if valid else None, low=min(samples) if valid else None, high=max(samples) if valid else None, status=row.get('status', 'ok'))

for dataset, file in [('javascript', 'comparison-timings'), ('native', 'djot-v-timings'), ('scaling', 'scaling-results'), ('confirmation', 'scaling-confirmation')]:
    data = json.loads((ROOT / 'reports' / f'{file}.json').read_text())
    groups = data['groups']
    metrics = [('wall', 'Milliseconds / operation'), ('cpu', 'CPU milliseconds / operation')]
    if dataset == 'native':
        metrics.append(('allocation', 'Allocated bytes / operation'))
    if dataset in ['scaling', 'confirmation']:
        metrics = metrics[:1]
    for family in sorted({g['family'] for g in groups}):
        for phase in sorted({g.get('mode', g.get('phase')) for g in groups}):
            for metric, unit in metrics:
                series = {}
                for group in groups:
                    if group['family'] != family or group.get('mode', group.get('phase')) != phase:
                        continue
                    rounds = group.get('rounds', [group])
                    for run in rounds:
                        rows = []
                        for row in run['rows']:
                            if dataset == 'native':
                                key = dict(wall='wallMs', cpu='cpuMs', allocation='allocatedBytes')[metric]
                                samples = [s[key] for s in row.get('samples', [])]
                            else:
                                samples = row.get('samplesMs' if metric == 'wall' else 'samplesCpuMs', [])
                            rows.append(observation(row, samples, 'nested' in family))
                        label = group.get('reader', 'djot.v / OCaml')
                        if 'round' in run:
                            label += ' / round ' + str(run['round'] + 1)
                        series[label] = rows
                if series:
                    note = 'Median and observed sample range, not a confidence interval. Phases are independent runs. API features differ; these curves are not a language ranking.'
                    if dataset == 'native':
                        note += ' This native run had high host load and is kept separate from JavaScript runs.'
                    if dataset in ['scaling', 'confirmation']:
                        note += ' The specification parse API builds blocks only. Missing or refused observations remain in the data table.'
                    export(dataset, family, phase, metric, unit, series, data['metadata'], note)

runtime = json.loads((ROOT / 'reports' / 'runtime-timings.json').read_text())
for reader, dataset, label in [('rs', 'rust', 'Carve Rust'), ('php', 'php', 'Carve PHP')]:
    metrics = [('wall', 'samplesMs', 'Wall milliseconds / operation'), ('cpu', 'samplesCpuMs', 'CPU milliseconds / operation')]
    if reader == 'rs':
        metrics += [('allocated-bytes', 'samplesAllocatedBytes', 'Requested allocation bytes / operation'), ('allocation-calls', 'samplesAllocationCalls', 'Allocation requests / operation')]
    else:
        metrics += [('peak-managed-growth', 'samplesPeakManagedBytes', 'Peak managed-memory growth (bytes / call)')]
    for group in runtime['groups']:
        if group['reader'] != reader:
            continue
        for metric, field, unit in metrics:
            points = [observation(row, row.get(field, []), 'nested' in group['family']) for row in group['rows']]
            memory_note = 'Rust counts requested allocation bytes, including full new realloc sizes, and allocation calls.' if reader == 'rs' else 'PHP measures peak managed-memory growth above the pre-call baseline, including the live result. This does not measure allocation churn. PHP ran without opcache or JIT.'
            note = 'Five warmed samples; bands show minimum and maximum, not confidence intervals. Render reuses a parsed AST; combined HTML may use fast paths. Memory is measured separately from timing. ' + memory_note + ' Memory metrics differ between runtimes and must not be compared as the same quantity. Historical runs do not establish a speed ranking or complexity bound.'
            export(dataset, group['family'], group['mode'], metric, unit, {label: points}, runtime['metadata'], note)

data = json.loads((ROOT / 'reports' / 'nesting-profile.json').read_text())
for family in sorted({g['family'] for g in data['groups']}):
    for phase in ['parse', 'render']:
        for metric, unit in [('regex-calls', 'Instrumented regular expression calls'), ('regex-input', 'Regex input exposure (UTF-16 units)'), ('regex-matched', 'Successful regex match lengths (UTF-16 units)'), ('regex-advance', 'Global regex forward progress (UTF-16 units)'), ('suffix-input', 'Suffix argument lengths (UTF-16 units)'), ('layout', 'Instrumented layout operations'), ('sampled-allocation', 'Sampled allocation bytes / operation')]:
            series = {}
            for group in data['groups']:
                if group['family'] != family or group['phase'] != phase:
                    continue
                assert all('y' not in p['pattern'].rsplit('/', 1)[-1] for p in group['patterns']), 'Review sticky regex instrumentation'
                if metric == 'regex-calls':
                    value = sum(p['calls'] for p in group['patterns'])
                elif metric == 'regex-input':
                    value = sum(p['inputChars'] for p in group['patterns'])
                elif metric == 'regex-matched':
                    value = sum(p['matchedChars'] for p in group['patterns'])
                elif metric == 'regex-advance':
                    value = sum(p['globalAdvance'] for p in group['patterns'])
                elif metric == 'suffix-input':
                    value = group['suffixes']['suffixChars']
                elif metric == 'layout':
                    value = group['layout'].get('total', sum(group['layout'].values()))
                else:
                    value = group['sampledAllocationBytes'] / group['heapIterations']
                series.setdefault(group['reader'], []).append(dict(x=group['size'], value=value, low=value, high=value, status='ok'))
            if series:
                export('profile', family, phase, metric, unit, series, data['metadata'], 'Instrumentation covers selected operations. Input exposure, successful match lengths, global progress and suffix argument lengths do not count engine steps. Heap sampling estimates allocation churn, not retained memory. Reader counters have different scopes. These measurements do not prove asymptotic complexity.')
                export('profile-js', family, phase, metric, unit, {'js': series['js']}, data['metadata'], 'JavaScript reader only. Input exposure, successful match lengths, global progress and suffix argument lengths do not count engine steps. Failed non-global scans and non-regex operations are outside the match-length counter. These measurements do not prove asymptotic complexity.')
for dataset, history in [('prefix-change', 'pre-prefix-refresh'), ('tail-change', 'pre-tail-refresh')]:
    before = json.loads((ROOT / 'reports/history' / history / 'nesting-profile.json').read_text())
    after_path = 'reports/history/pre-current-refresh/nesting-profile.json' if dataset == 'tail-change' else 'reports/nesting-profile.json'
    after = json.loads((ROOT / after_path).read_text())
    for family in ['quotes', 'lists']:
        for metric, unit in [('regex-calls', 'Instrumented regular expression calls'), ('regex-input', 'Regex input exposure (UTF-16 units)'), ('sampled-allocation', 'Sampled allocation bytes / operation')]:
            series = {}
            for label, report in [('before', before), ('after', after)]:
                pin = report['metadata']['engine'].split('#')[-1][:10]
                rows = []
                for group in report['groups']:
                    if group['reader'] != 'js' or group['phase'] != 'parse' or group['family'] != family:
                        continue
                    if metric == 'regex-calls':
                        samples = [sum(p['calls'] for p in group['patterns'])]
                    elif metric == 'regex-input':
                        samples = [sum(p['inputChars'] for p in group['patterns'])]
                    elif metric == 'sampled-allocation':
                        samples = [group['sampledAllocationBytes'] / group['heapIterations']]
                    else:
                        samples = [s['wallMs'] for s in group['samples']]
                    rows.append(observation(group, samples, True))
                series[f'{label} / {pin}'] = rows
            metadata = dict(generatedAt=after['metadata']['generatedAt'], before=before['metadata'], after=after['metadata'])
            export(dataset, family, 'parse', metric, unit, series, metadata, 'Different pinned reader revisions and historical runs. Regex calls use the same instrumentation; timing and allocation are affected by host load and sampling. These observations do not isolate a single commit or prove a complexity bound.')
tails = json.loads((ROOT / 'reports/container-tail-work.json').read_text())
for family in sorted({g['family'] for g in tails['groups']}):
    for metric, field, unit in [('regex-matched', 'matchedChars', 'Successful match lengths (UTF-16 units)'), ('regex-input', 'inputChars', 'Regex input exposure (UTF-16 units)'), ('suffix-input', 'suffixChars', 'Suffix argument lengths (UTF-16 units)'), ('terminator-input', 'terminatorInput', 'Terminator scan input (UTF-16 units)')]:
        series = {}
        for group in tails['groups']:
            if group['family'] != family:
                continue
            value = group['suffixes'][field] if field == 'suffixChars' else group[field]
            label = group['reader'] + ' / ' + tails['metadata'][group['reader']]['source'].split('#')[-1][:10]
            series.setdefault(label, []).append(dict(x=group['size'], value=value, low=value, high=value, status='ok'))
        export('container-tails', family, 'parse', metric, unit, series, tails['metadata'], tails['metadata']['method'])
for family in sorted({g['family'] for g in tails['copies']}):
    label = 'candidate / ' + tails['metadata']['candidate']['source'].split('#')[-1][:10]
    points = [dict(x=g['size'], value=g['seam'], low=g['seam'], high=g['seam'], status='ok') for g in tails['copies'] if g['family'] == family]
    export('container-tails', family, 'parse', 'seam-copy', 'Selected copied lengths (UTF-16 units)', {label: points}, tails['metadata'], 'Candidate only. Each leaf has 100,000 characters. Counts source normalization and attributed-tail reconstruction, not total allocation. The baseline does not instrument the same copy sites.')
costs = json.loads((ROOT / 'reports/current-costs.json').read_text())
for family in sorted({g['family'] for g in costs['groups']}):
    for phase in ['parse', 'html', 'direct-html-probe']:
        for metric, unit in [('wall', 'Wall milliseconds / operation'), ('cpu', 'CPU milliseconds / operation'), ('sampled-allocation', 'Sampled allocation bytes / operation')]:
            series = {}
            for group in costs['groups']:
                if group['family'] != family or group['phase'] != phase:
                    continue
                for round in group['rounds']:
                    values = [round['sampledAllocationBytes'] / round['heapIterations']] if metric == 'sampled-allocation' else [s[metric + 'Ms'] for s in round['samples']]
                    series[group['variant'] + ' / round ' + str(round['round'] + 1)] = [observation(group, values, 'nested' in family)]
            export('current-costs', family, phase, metric, unit, series, costs['metadata'], costs['metadata']['method'] + ' Error bars show sample minimum and maximum, not confidence intervals. Fresh-worker rounds remain separate; pooled medians would hide variation. These timings do not establish a performance ordering. Heap sampling measures allocation churn, not retained memory. Carve positions:false drops fields after parsing; it does not bypass position construction.')
live = {chart['id'] for chart in charts}
for path in OUT.iterdir():
    if path.name not in ['index.json', 'catalog.json'] and path.stem not in live:
        path.unlink()
(OUT / 'index.json').write_text(json.dumps(charts))
(OUT / 'catalog.json').write_text(json.dumps([{key: chart[key] for key in ['id', 'dataset', 'family', 'phase', 'metric', 'unit', 'xUnit']} for chart in charts]))
print(f'Exported {len(charts)} charts as SVG, PNG, CSV and JSON')
