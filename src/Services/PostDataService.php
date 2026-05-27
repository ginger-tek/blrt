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
      htmlspecialchars($data['body'])
    ]);
    return $this->get($id);
  }

  public function get(string $id): ?object
  {
    return $this->db->run('select * from v_posts where id = ?', [$id])->fetch() ?: null;
  }

  public function feed(string $user_id, int $page = 0): array
  {
    return $this->db->run("select distinct
      p.*
    from user_interests ui
    join v_posts p on p.body like '%' || ui.interest || '%' or ui.interest = '*'
    where ui.user_id = ?
    order by created_at desc
    limit 20 offset $page", [$user_id])->fetchAll();
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
}