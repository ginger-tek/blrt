<?php

namespace App\Services;

use Ramsey\Uuid\Uuid;

class PostDataService
{
  private Db $db;

  public function __construct(Db $db = new Db)
  {
    $this->db = $db;
  }

  public function create(array $data): ?object
  {
    $id = Uuid::uuid4()->toString();
    $this->db->run("insert into posts(id,author_id,body)
      values(?,?,?)", [
      $id,
      $data['author_id'],
      htmlspecialchars($data['body']),
      (is_array($data['media']) ? join(',', $data['media']) : $data['media']),
    ]);
    return $this->get($id);
  }

  public function get(string $id): ?object
  {
    return $this->db->run('select * from v_posts where id = ?', [$id])->fetch() ?: null;
  }

  public function createComment(array $data): ?object
  {
    $this->db->run("insert into post_comments(post_id,author_id,body)
      values(?,?,?)", [
      $data['post_id'],
      $data['author_id'],
      htmlspecialchars($data["body"])
    ]);
    return $this->getComment($this->db->getLastInsertId());
  }

  public function getComment(string $id): ?object
  {
    return $this->db->run("select * from v_post_comments where id = ?", [$id])->fetch() ?: null;
  }

  public function listComments(string $postId): array
  {
    return $this->db->run("select * from v_post_comments where post_id = ?", [$postId])->fetchAll();
  }

  public function feed(string $user_id, int $page = 0): array
  {
    return $this->db->run("select distinct
      p.*
    from v_posts p
    where exists (
      select 1
      from user_interests uif
      where user_id = :user_id
      and (
        p.body like '%' || uif.interest || '%'
        or p.author_username = uif.interest
      )
    )
    or not exists (
      select 1
      from user_interests
      where user_id = :user_id
    )
    order by created_at desc
    limit 20 offset $page", [':user_id' => $user_id])->fetchAll();
  }

  public function find(string $query): array
  {
    return $this->db->run('select * from v_posts where body like ?', ["'%{$query}%'"])->fetchAll();
  }

  public function profilePosts(string $user_id): array
  {
    return [
      'top' => $this->db->run("select * from v_posts where author_id = ? order by like_count desc, comment_count desc limit 5", [$user_id])->fetchAll(),
      'recent' => $this->db->run("select * from v_posts where author_id = ? order by created_at desc limit 5", [$user_id])->fetchAll(),
    ];
  }

  public function deletePost(string $id, string $user_id): bool
  {
    return $this->db->run("delete from posts where id = ? and author_id = ? limit 1", [$id, $user_id])->rowCount() == 1;
  }
}