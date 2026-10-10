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

try {
    $sources = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
    if (!is_array($sources) || !array_is_list($sources)) throw new InvalidArgumentException('Expected source array');
    $parser = new \MarkupCarve\Carve\Parser\BlockParser(trackPositions: true);
    $codec = new \MarkupCarve\Carve\Ast\AstCodec();
    $renderer = new \MarkupCarve\Carve\Renderer\HtmlRenderer();
    $results = [];
    foreach ($sources as $source) {
        try {
            if (!is_string($source)) throw new InvalidArgumentException('Expected source string');
            $doc = $parser->parse($source);
            $result = ['html' => $renderer->render($doc)];
            if (in_array('--ast', $argv, true)) $result['ast'] = $codec->encode($doc);
            $results[] = $result;
        } catch (Throwable $error) {
            $results[] = ['error' => $error->getMessage()];
        }
    }
    echo json_encode($results, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
