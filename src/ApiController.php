<?php

namespace App;

use GingerTek\Routy;

class ApiController
{
  public static function listFeed(Routy $app)
  {
    $posts = (new \App\PostData)->feed($app->getCtx('user')->id);
    $app->sendJson(['count' => count($posts), 'items' => $posts]);
  }

  public static function getPost(Routy $app)
  {
    $app->sendJson((new \App\PostData)->get($app->getParam('id')));
  }

  public static function submitCreatePost(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->body) || !is_string($body->body))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $app->sendJson((new \App\PostData)->create([
      'author_id' => $app->getCtx('user')->id,
      'body' => $body->body
    ]));
  }

  public static function submitSearch(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->query) || !is_string($body->query))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $results = (new \App\SearchData)->query($body->query, $body->order_by ?? null);
    $app->sendJson($results);
  }

  public static function getProfile(Routy $app)
  {
    $user = $app->getCtx('user');
    $user->posts = (new \App\PostData)->profilePosts($user->id);
    $app->sendJson($user);
  }

  public static function getProfileInterests(Routy $app)
  {
    $app->sendJson((new \App\UserData)->listInterests($app->getCtx('user')->id));
  }

  public static function putProfileInterests(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->interests) || empty($body->interests))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    (new \App\UserData)->updateInterests($app->getCtx('user')->id, ['interests' => $body->interests, 'removed' => $body->removed]);
    $app->sendJson(['message' => 'Successfully updated interests']);
  }

  public static function getUserProfile(Routy $app)
  {
    $user = (new \App\UserData)->findDTO($app->getParam('username'));
    if (!$user)
      return $app->status(404)->sendJson(['User not found']);
    $user->posts = (new \App\PostData)->profilePosts($user->id);
    $app->sendJson($user);
  }
}