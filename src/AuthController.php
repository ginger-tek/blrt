<?php

namespace App;

use GingerTek\Routy;

class AuthController
{
  public static function submitSignup(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->username, $body->password, $body->display_name))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $svc = new \App\UserData;
    if ($svc->find($body->username))
      return $app->status(409)->sendJson(['error' => 'Username already exists']);
    $user = $svc->create([
      'username' => $body->username,
      'passhash' => password_hash($body->password, PASSWORD_BCRYPT),
      'display_name' => $body->display_name
    ]);
    if (!$user)
      return $app->status(500)->sendJson(['error' => 'Failed to signup']);
    $app->status(201)->sendJson(['message' => 'Successfully signed up']);
  }

  public static function submitLogin(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->username, $body->password))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $user = (new \App\UserData)->find($body->username);
    if (!$user || !password_verify($body->password, $user->passhash))
      return $app->status(401)->sendJson(['error' => 'Invalid username or password']);
    [$token, $exp] = \App\TokenService::sign([
      'sub' => $user->id,
      'preferred_username' => $user->username,
      'name' => $user->display_name
    ]);
    if (!$token || !$exp)
      return $app->status(500)->sendJson(['error' => 'An error occurred']);
    setcookie('exp', $exp, ['expires' => $exp, 'path' => '/', 'httpOnly' => false]);
    setcookie('token', $token, ['expires' => $exp, 'path' => '/', 'httpOnly' => true]);
    $app->sendJson(['message' => 'Successfully logged in', 'token' => $token, 'exp' => $exp]);
  }

  public static function submitLogout(Routy $app)
  {
    $past = time() - 60;
    setcookie('exp', '', ['expires' => $past, 'path' => '/', 'httpOnly' => false]);
    setcookie('token', '', ['expires' => $past, 'path' => '/', 'httpOnly' => true]);
    $app->sendJson(['message' => 'Successfully logged out']);
  }
}