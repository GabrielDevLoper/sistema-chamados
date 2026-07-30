-- Seed exclusivo para desenvolvimento local.
-- Login: velyondev@gmail.com
-- Senha: 123456
INSERT INTO users (
  name,
  email,
  password_hash,
  role,
  status,
  password_changed_at
) VALUES (
  'Velyon ADM',
  'velyondev@gmail.com',
  'pbkdf2_sha256$100000$MsupqA0LGZ3dJsaoHGneoA$mFe2LcHRUEt1ezn7_oB4AzO9DH0Z4bnR8gAwlqB_9M4',
  'platform_admin',
  'active',
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO NOTHING;
