<?php

namespace App;

class SearchData
{
  private Db $db;

  public function __construct(Db $db = new Db)
  {
    $this->db = $db;
  }

  public function query(string $query, ?string $order_by): array
  {
    $order_by ??= 'created_at';
    $query = htmlspecialchars(strip_tags($query));
    $posts = $this->db->run("select * from v_posts where body like ? order by ? limit 5", ["%{$query}%", $order_by])->fetchAll();
    $users = $this->db->run("select * from v_users where username like :q or display_name like :q limit 5", [':q' => "%{$query}%"])->fetchAll();
    return [
      'total' => count($posts) + count($users),
      'posts' => $posts,
      'users' => $users
    ];
  }
}