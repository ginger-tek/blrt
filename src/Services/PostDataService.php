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
    $this->db->run("insert into posts(id,author_id,body,media)
      values(?,?,?,?)", [
      $id,
      $data['author_id'],
      htmlspecialchars($data['body']),
      join('|', $data['media'])
    ]);
    return $this->get($id, $data['author_id']);
  }

  public function get(string $id, string $user_id): ?object
  {
    return $this->db->run('select p.*,
    count(l.id) as liked
    from v_posts p
    left join likes l on l.rec_type = 1 and l.rec_id = p.id and l.user_id = ?
    where p.id = ?
    group by p.id', [$user_id, $id])->fetch() ?: null;
  }

  public function createLike(array $data): bool
  {
    $this->db->run("insert or ignore into likes(rec_type,rec_id,user_id)
    values(?,?,?)", [
      1,
      $data['post_id'],
      $data['user_id']
    ]);
    return true;
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

  public function listComments(string $post_id, string $user_id): array
  {
    return $this->db->run("select c.*,
      count(l.id) as liked
    from v_post_comments c
    left join likes l on l.rec_type = 2 and l.rec_id = c.id and l.user_id = ?
    where post_id = ?
    group by c.id", [$user_id, $post_id])->fetchAll();
  }

  public function feed(string $user_id, int $page = 0): array
  {
    return $this->db->run("select distinct
      p.*,
      count(l.id) as liked
    from v_posts p
    left join likes l on l.rec_type = 1 and l.rec_id = p.id and l.user_id = :user_id
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
    group by p.id
    order by like_count desc, comment_count desc, created_at desc
    limit 20 offset $page", [':user_id' => $user_id])->fetchAll();
  }

  public function find(string $query): array
  {
    return $this->db->run('select * from v_posts where body like ?', ["'%{$query}%'"])->fetchAll();
  }

  public function profilePosts(string $user_id, string $session_user_id): array
  {
    return [
      'top' => $this->db->run("select p.*,
        count(l.id) as liked
      from v_posts p
      left join likes l on l.rec_type = 1 and l.rec_id = p.id and l.user_id = :session_user_id
      where p.author_id = :user_id
      group by p.id
      order by like_count desc, comment_count desc
      limit 5", [
        ':user_id' => $user_id,
        ':session_user_id' => $session_user_id
      ])->fetchAll(),
      'recent' => $this->db->run("select p.*,
        count(l.id) as liked
      from v_posts p
      left join likes l on l.rec_type = 1 and l.rec_id = p.id and l.user_id = :session_user_id
      where p.author_id = :user_id
      group by p.id
      order by created_at desc
      limit 5", [
        ':user_id' => $user_id,
        ':session_user_id' => $session_user_id
      ])->fetchAll(),
    ];
  }

  public function deletePost(string $id, string $user_id): bool
  {
    return $this->db->run("update posts set
    is_deleted = 1, body = '[deleted]', media = null
    where id = ? and author_id = ?
    limit 1", [$id, $user_id])->rowCount() == 1;
  }
}