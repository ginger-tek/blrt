<?php

namespace App\Controllers;

use GingerTek\Routy;
use App\Services\UserDataService;
use App\Services\SearchDataService;
use App\Services\PostDataService;

class ApiController
{
  public static function submitCreatePost(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->body) || !is_string($body->body))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $app->sendJson((new PostDataService)->create([
      'author_id' => $app->getCtx('user')->id,
      'body' => $body->body,
      'media' => $body->media ?? []
    ]));
  }

  public static function listFeed(Routy $app)
  {
    $posts = (new PostDataService)->feed($app->getCtx('user')->id);
    $app->sendJson(['count' => count($posts), 'items' => $posts]);
  }

  public static function getPost(Routy $app)
  {
    $post = (new PostDataService)->get($app->getParam('id'), $app->getCtx('user')->id);
    if (!$post)
      return $app->status(404)->sendJson(['error' => 'Post not found']);
    $app->sendJson($post);
  }

  public static function getPostComments(Routy $app)
  {
    $post = (new PostDataService)->get($app->getParam('id'), $app->getCtx('user')->id);
    if (!$post)
      return $app->status(404)->sendJson(['error' => 'Post not found']);
    $app->sendJson((new PostDataService)->listComments($post->id, $app->getCtx('user')->id));
  }

  public static function submitPostComment(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->body) || !is_string($body->body))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $post = (new PostDataService)->get($app->getParam('id'), $app->getCtx('user')->id);
    if (!$post)
      return $app->status(404)->sendJson(['error' => 'Post not found']);
    $app->sendJson((new PostDataService)->createComment([
      'post_id' => $post->id,
      'author_id' => $app->getCtx('user')->id,
      'body' => $body->body
    ]));
  }

  public static function submitPostLike(Routy $app)
  {
    $post = (new PostDataService)->get($app->getParam('id'), $app->getCtx('user')->id);
    if (!$post)
      return $app->status(404)->sendJson(['error' => 'Post not found']);
    $app->status(201)->sendJson(['result' => (new PostDataService)->createLike([
      'post_id' => $post->id,
      'user_id' => $app->getCtx('user')->id,
    ])]);
  }

  public static function deletePost(Routy $app)
  {
    $post = (new PostDataService)->get($app->getParam('id'), $app->getCtx('user')->id);
    if (!$post)
      return $app->status(404)->sendJson(['error' => 'Post not found']);
    if ($app->getCtx('user')->id != $post->author_id)
      return $app->status(403)->sendJson(['error' => 'Insufficent permissions']);
    $result = (new PostDataService)->deletePost($post->id, $app->getCtx('user')->id);
    $app->sendJson(['result' => $result]);
  }

  public static function submitSearch(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->query) || !is_string($body->query))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $results = (new SearchDataService)->query($body->query, $body->order_by ?? null);
    $app->sendJson($results);
  }

  public static function getProfile(Routy $app)
  {
    $user = $app->getCtx('user');
    $app->sendJson($user);
  }

  public static function getProfilePosts(Routy $app) {
    $posts = (new PostDataService)->profilePosts($app->getCtx('user')->id, $app->getCtx('user')->id);
    $app->sendJson($posts);
  }

  public static function getProfileInterests(Routy $app)
  {
    $app->sendJson((new UserDataService)->listInterests($app->getCtx('user')->id));
  }

  public static function putProfileInterests(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->interests))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    (new UserDataService)->updateInterests($app->getCtx('user')->id, ['interests' => $body->interests, 'removed' => $body->removed]);
    $app->sendJson(['message' => 'Successfully updated interests']);
  }

  public static function getUserProfile(Routy $app)
  {
    $user = (new UserDataService)->findDTO($app->getParam('username'));
    if (!$user)
      return $app->status(404)->sendJson(['User not found']);
    $app->sendJson($user);
  }

  public static function getUserProfilePosts(Routy $app)
  {
    $posts = (new PostDataService)->profilePosts($app->getParam('id'), $app->getCtx('user')->id);
    $app->sendJson($posts);
  }

  public static function putProfile(Routy $app)
  {
    $body = $app->getBody();
    if (!$body || !isset($body->display_name))
      return $app->status(400)->sendJson(['error' => 'Missing required values']);
    $app->sendJson((new UserDataService)->updateProfile($app->getCtx('user')->id, [
      'display_name' => $body->display_name,
      'bio' => $body->bio ?? null,
      'pfp' => $body->pfp ?? null
    ]));
  }
}