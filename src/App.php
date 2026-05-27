<?php

const ROOT = __DIR__ . '/..';
require ROOT . '/vendor/autoload.php';

use App\Middleware\AuthMiddleware;
use App\Controllers\AuthController;
use App\Controllers\ApiController;

$app = new \GingerTek\Routy;

try {
  $app->group('/api', function ($app) {
    $app->get('/session', AuthMiddleware::identify(...), AuthController::getSession(...));
    $app->post('/login', AuthController::submitLogin(...));
    $app->post('/signup', AuthController::submitSignup(...));
    
    $app->use(AuthMiddleware::guard(...));
    
    $app->post('/logout', AuthController::submitLogout(...));
    $app->get('/feed', ApiController::listFeed(...));
    $app->get('/posts/:id', ApiController::getPost(...));
    $app->post('/posts', ApiController::submitCreatePost(...));
    $app->post('/search', ApiController::submitSearch(...));
    $app->get('/profile', ApiController::getProfile(...));
    $app->get('/profile/interests', ApiController::getProfileInterests(...));
    $app->put('/profile/interests', ApiController::putProfileInterests(...));
    $app->get('/users/@:username', ApiController::getUserProfile(...));

    $app->fallback(fn() => $app->sendJson(['message' => 'Route not found']));
  });
} catch (\Exception $ex) {
  error_log($ex->getMessage());
  $app->status(500)->sendJson(['error' => 'An error occurred']);
}