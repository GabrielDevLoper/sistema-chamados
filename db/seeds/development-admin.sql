-- Seed exclusivo para desenvolvimento local.
-- Login: adm@gmail.com
-- Senha: 123456
INSERT INTO users (
  name,
  email,
  password_hash,
  role,
  status,
  password_changed_at
) VALUES (
  'Administrador',
  'adm@gmail.com',
  'pbkdf2_sha256$600000$MsupqA0LGZ3dJsaoHGneoA$vOuSDIGT0JeNHI6BwEf35GzMHU081YJ9OlVcdj5y4Fo',
  'platform_admin',
  'active',
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO NOTHING;
