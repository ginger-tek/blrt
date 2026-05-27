<?php

namespace App;

class Db
{
  private \PDO $pdo;

  public function __construct()
  {
    $this->pdo = new \PDO(
      getenv('DB_DSN') ?: 'sqlite:' . ROOT . '/blrt.db',
      getenv('DB_USER') ?: null,
      getenv('DB_PASS') ?: null,
      [
        \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
        \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_OBJ
      ]
    );
    $this->pdo->exec(<<<SQL
    pragma journal_mode=WAL;

    create table if not exists users(
      id text primary key,
      username text unique not null,
      passhash text not null,
      display_name text not null,
      bio text default '',
      pfp text default '',
      is_active integer default 1,
      created_at integer default (unixepoch()),
      updated_at integer default (unixepoch())
    );

    create table if not exists user_interests(
      id integer primary key,
      user_id text not null,
      interest text not null,
      unique (user_id, interest)
    );

    create table if not exists posts(
      id text primary key,
      author_id text not null,
      body text not null,
      is_deleted integer default 0,
      created_at integer default (unixepoch()),
      updated_at integer default (unixepoch())
    );

    create table if not exists post_comments(
      id integer primary key,
      post_id text not null,
      author_id text not null,
      reply_to_id text,
      body not null,
      created_at integer default (unixepoch()),
      updated_at integer default (unixepoch())
    );

    create table if not exists likes(
      id integer primary key,
      rec_type integer default 1,
      rec_id text not null,
      user_id text not null,
      unique (rec_type, rec_id, user_id)
    );

    create index if not exists posts_body_idx on posts(body);

    drop view if exists v_users;
    create view v_users
    as
    select id, username, display_name, pfp
    from users;
    
    drop view if exists v_posts;
    create view v_posts
    as
    select p.id,
      p.body,
      p.created_at,
      p.author_id,
      a.username as author_username,
      a.display_name as author_name,
      a.pfp as author_pfp,
      count(l.id) as like_count,
      count(pc.id) as comment_count
    from posts p
    join users a on a.id = p.author_id
    left join likes l on l.rec_type = 1 and l.rec_id = p.id
    left join post_comments pc on pc.post_id = p.id
    group by p.id;

    drop view if exists v_post_comments;
    create view v_post_comments
    as
    select pc.id,
      pc.body,
      pc.created_at,
      pc.author_id,
      a.username as author_username,
      a.display_name as author_name,
      a.pfp as author_pfp,
      count(l.id) as like_count,
      count(rc.id) as comment_count
    from post_comments pc
    join users a on a.id = pc.author_id
    left join likes l on l.rec_type = 2 and l.rec_id = pc.id
    left join post_comments rc on rc.reply_to_id = pc.id
    group by pc.id;
    SQL);
  }

  public function run(string $sql, ?array $params = []): \PDOStatement
  {
    $stmt = $this->pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
  }
}