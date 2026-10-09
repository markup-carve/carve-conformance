<?php
declare(strict_types=1);
spl_autoload_register(static function (string $class): void {
    $prefix = 'MarkupCarve\\Carve\\';
    if (str_starts_with($class, $prefix)) {
        require $GLOBALS['argv'][1] . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    }
});
echo (new MarkupCarve\Carve\CarveConverter())->convert(stream_get_contents(STDIN));
