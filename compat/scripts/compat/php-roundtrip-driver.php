<?php

declare(strict_types=1);

$root = getenv('CARVE_PHP_ROOT') ?: __DIR__ . '/../../.cache/engines/php';
spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'MarkupCarve\\Carve\\';
    if (str_starts_with($class, $prefix)) {
        $path = $root . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
        if (is_file($path)) require $path;
    }
});

use MarkupCarve\Carve\Converter\HtmlToCarve;
use MarkupCarve\Carve\Converter\MarkdownToCarve;
use MarkupCarve\Carve\Parser\BlockParser;
use MarkupCarve\Carve\Renderer\CarveRenderer;
use MarkupCarve\Carve\Renderer\HtmlRenderer;
use MarkupCarve\Carve\Renderer\MarkdownRenderer;

try {
    $requests = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($requests) || !array_is_list($requests)) throw new InvalidArgumentException('Expected a JSON array of roundtrip requests');
    $results = [];
    foreach ($requests as $request) {
        try {
            $source = $request['source'] ?? null;
            if (!is_string($source)) throw new InvalidArgumentException('Expected a string source');
            $doc = (new BlockParser())->parse($source);
            $results[] = ['value' => match ($request['chain'] ?? null) {
                'html' => (new HtmlToCarve())->convert((new HtmlRenderer())->render($doc)),
                'html-carriers' => (new HtmlToCarve())->convert((new HtmlRenderer())->setRoundTripMode(true)->render($doc)),
                'markdown' => (new MarkdownToCarve())->convert((new MarkdownRenderer())->render($doc)),
                'markdown-carriers' => (new MarkdownToCarve())->convert((new MarkdownRenderer())->setRoundTripMode(true)->render($doc)),
                'fmt' => (new CarveRenderer())->render($doc),
                default => throw new InvalidArgumentException('Unknown roundtrip chain'),
            }];
        } catch (Throwable $error) {
            $results[] = ['error' => $error->getMessage()];
        }
    }
    echo json_encode($results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
