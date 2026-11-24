<?php

declare(strict_types=1);

// carve-php next2 boundary: a JSON list of requests in, one {ok} or {error} per request out.
$root = getenv('CARVE_PHP_NEXT2_ROOT') ?: __DIR__ . '/../../.cache/engines/php-next2';
require $root . '/vendor/autoload.php';

use MarkupCarve\Carve\Carve;

$diagnostics = static fn (array $list): array => array_map(static fn ($d): array => ['code' => $d->code, 'path' => $d->path], $list);

try {
    $requests = json_decode(stream_get_contents(STDIN), true, 4096, JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
$responses = [];
foreach ($requests as $request) {
    try {
        $tree = isset($request['tree']) ? Carve::decodeTree(json_encode($request['tree'], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) : null;
        $responses[] = ['ok' => match ($request['call']) {
            'parse' => json_decode(Carve::encodeTree(Carve::parse($request['source'])), true, 4096, JSON_THROW_ON_ERROR),
            'decodeTree' => json_decode(Carve::encodeTree($tree), true, 4096, JSON_THROW_ON_ERROR),
            'write' => (static function () use ($tree, $diagnostics): array {
                $written = Carve::writeWithDiagnostics($tree);

                return ['source' => $written->source, 'diagnostics' => $diagnostics($written->diagnostics)];
            })(),
            'render' => Carve::render($tree),
        }];
    } catch (Throwable $error) {
        $responses[] = ['error' => get_class($error) . ': ' . $error->getMessage()];
    }
}
echo json_encode($responses, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
