<?php

namespace App\Services;

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
    $this->pdo->exec(file_get_contents(ROOT . '/schema.sql'));
  }

  public function run(string $sql, ?array $params = []): \PDOStatement
  {
    $stmt = $this->pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
  }

  public function getLastInsertId(): int
  {
    return $this->pdo->lastInsertId() ?: 0;
  }
}