export function cases() {
  const rows = []
  const add = (family, id, source, parameters) => rows.push({ family, id, source, parameters })
  for (const host of ['footnote-quote', 'footnote-paragraph', 'list-quote']) {
    for (let indent = 2; indent <= 8; indent++) for (const fence of ['code', 'raw']) {
      const prefix = host === 'list-quote' ? '- > q\n\n' : `x[^1]\n\n[^1]: ${host === 'footnote-quote' ? '> q' : 'q'}\n\n`
      const pad = ' '.repeat(indent)
      add('fences', `${host}/${indent}/${fence}`, prefix + `${pad}\`\`\`${fence === 'code' ? 'js' : '=html'}\n${pad}${fence === 'code' ? 'c' : '<b>c</b>'}\n${pad}\`\`\`\n`, { host, indent, fence })
    }
  }
  const empty = { comment: '%% n', reference: '[r]: /target', code: '```\n```', raw: '```=latex\nx\n```', visible: 'b' }
  for (const [block, payload] of Object.entries(empty)) for (const wrapper of ['list', 'quote-list']) {
    for (const tail of ['', '\n- b\n', '\n  tail\n']) {
      let source = '- a\n\n' + payload.split('\n').map(line => '  ' + line).join('\n') + '\n' + tail
      if (wrapper === 'quote-list') source = source.trimEnd().split('\n').map(line => '> ' + line).join('\n') + '\n'
      add('empty-slots', `${wrapper}/${block}/${tail === '' ? 'end' : tail.includes('- b') ? 'sibling' : 'tail'}`, source, { wrapper, block, tail })
    }
  }
  const hosts = { list: '- intro', 'quote-list': '> - intro', 'list-quote': '- > intro', 'list-list': '- - intro' }
  const boundaries = { ordinary: null, blank: '', 'low-comment': '%% c', 'content-comment': '  %% c', 'comment-blank': '%% c\n' }
  const followers = { text: 'tail', heading: '# tail', sibling: '- tail', quote: '> tail', fence: '```\ntail\n```' }
  for (const [host, opener] of Object.entries(hosts)) for (const [boundary, line] of Object.entries(boundaries)) {
    for (const indent of [0, 1, 2, 4]) for (const [follower, body] of Object.entries(followers)) {
      const prefix = host === 'quote-list' ? '> ' : ''
      const between = line === null ? '' : line.split('\n').map(x => prefix + x).join('\n') + '\n'
      const tail = body.split('\n').map(x => prefix + ' '.repeat(indent) + x).join('\n') + '\n'
      add('boundaries', `${host}/${boundary}/${indent}/${follower}`, opener + '\n' + between + tail, { host, boundary, indent, follower })
    }
  }
  return rows
}
