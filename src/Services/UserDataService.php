<?php

namespace App\Services;

use Ramsey\Uuid\Uuid;

class UserDataService
{
    private Db $db;

    public function __construct(Db $db = new Db)
    {
        $this->db = $db;
    }

    public function create(array $data): ?object
    {
        $id = Uuid::uuid4()->toString();
        $this->db->run("insert into users(id,username,passhash,display_name)
        values(?,?,?,?)", [
            $id,
            $data['username'],
            $data['passhash'],
            $data['display_name']
        ]);
        return $this->get($id);
    }

    public function getDTO(string $id): ?object
    {
        return $this->db->run('select id, username, display_name, pfp, bio, created_at from users where id = ?', [$id])->fetch() ?: null;
    }

    public function get(string $id): ?object
    {
        return $this->db->run('select * from users where id = ?', [$id])->fetch() ?: null;
    }

    public function find(string $username): ?object
    {
        return $this->db->run('select * from users where username = ?', [$username])->fetch() ?: null;
    }

    public function findDTO(string $username): ?object
    {
        return $this->db->run('select id, username, display_name, pfp, bio, created_at from users where username = ?', [$username])->fetch() ?: null;
    }

    public function listInterests(string $user_id): array
    {
        return $this->db->run('select interest from user_interests where user_id = ?', [$user_id])->fetchAll(\PDO::FETCH_COLUMN, 0);
    }

    public function updateInterests(string $user_id, array $data): bool
    {
        if (is_array($data['interests'] ?? false)) {
            $count = count($data['interests']);
            if ($count > 0 && $count < 25) {
                $val_sets = join(',', array_map(fn($i) => "('$user_id','$i')", $data['interests']));
                if ($val_sets)
                    $this->db->run("insert or ignore into user_interests(user_id,interest) values $val_sets");
            }
        }
        if (is_array($data['removed'] ?? false) && count($data['removed']) > 0) {
            $val_set = '(' . join(',', array_map(fn($r) => "'$r'", $data['removed'])) . ')';
            $this->db->run("delete from user_interests where user_id = ? and interest in $val_set", [$user_id]);
        }
        return true;
    }
}