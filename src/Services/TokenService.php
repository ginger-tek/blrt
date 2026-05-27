<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;

class TokenService
{
    private const string ALGO = 'HS256';

    /**
     * @return array{exp: int, token: string}|bool
     */
    public static function sign(array $data, int $exp = 38400): array|bool
    {
        try {
            $exp += time();
            $token = JWT::encode(
                [
                    'iat' => time(),
                    'iss' => getenv('APP_HOST') ?: 'localhost',
                    'exp' => $exp,
                    ...$data
                ],
                getenv('JWT_SECRET'),
                self::ALGO
            );
            return [$token, $exp];
        } catch (\Exception $ex) {
            return false;
        }
    }

    public static function verify($token): object|null|bool
    {
        try {
            return JWT::decode(
                $token,
                new Key(getenv('JWT_SECRET'), self::ALGO)
            );
        } catch (ExpiredException $ex) {
            return false;
        } catch (\Exception $ex) {
            return null;
        }
    }
}