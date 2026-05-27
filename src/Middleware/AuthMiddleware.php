<?php

namespace App\Middleware;

use GingerTek\Routy;
use App\Services\TokenService;
use App\Services\UserDataService;

class AuthMiddleware
{
  public static function identify(Routy $app): bool
  {
    $token = $app->getHeader('x-token') ?: $_COOKIE['token'] ?? false;
    if (!$token)
      return false;
    $parsed = TokenService::verify(str_replace('Bearer ', '', $token));
    if (!$parsed)
      return false;
    $app->setCtx('session', $parsed);
    return true;
  }

  public static function guard(Routy $app)
  {
    if (!self::identify($app))
      return $app->status(401)->sendJson(['error' => 'Unauthorized']);
    $user = (new UserDataService)->getDTO($app->getCtx('session')->sub);
    if (!$user)
      return $app->status(401)->sendJson(['error' => 'Unauthorized']);
    $app->setCtx('user', $user);
  }
}