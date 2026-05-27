<?php

const ROOT = __DIR__ . '/..';
require ROOT . '/vendor/autoload.php';

$app = new \GingerTek\Routy;

try {
  $app->group('/api', function ($app) {
    $app->group('/auth', function ($app) {
      $app->get('/session', \App\AuthMiddleware::identify(...), fn() => $app->sendJson($app->getCtx('session') ?: new stdClass));
      $app->post('/login', \App\AuthController::submitLogin(...));
      $app->post('/signup', \App\AuthController::submitSignup(...));
      $app->post('/logout', \App\AuthMiddleware::guard(...), \App\AuthController::submitLogout(...));
    });

    $app->use(\App\AuthMiddleware::guard(...));

    $app->get('/feed', \App\ApiController::listFeed(...));
    $app->get('/posts/:id', \App\ApiController::getPost(...));
    $app->post('/posts', \App\ApiController::submitCreatePost(...));
    $app->post('/search', \App\ApiController::submitSearch(...));
    $app->get('/profile', \App\ApiController::getProfile(...));
    $app->get('/profile/interests', \App\ApiController::getProfileInterests(...));
    $app->put('/profile/interests', \App\ApiController::putProfileInterests(...));
    $app->get('/users/@:username', \App\ApiController::getUserProfile(...));

    $app->fallback(fn() => $app->sendJson(['message' => 'Route not found']));
  });
} catch (\Exception $ex) {
  error_log($ex->getMessage());
  $app->status(500)->sendJson(['error' => 'An error occurred']);
}