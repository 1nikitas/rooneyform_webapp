# Развёртывание RooneyForm на продакшн-сервере

Ниже пример конфигурации для Ubuntu 22.04+ (root-доступ). Путь `/var/www/rooneyform_app` можно заменить на свой.

## 0. Единый конфиг

1. Заполните `deploy/config.env` под ваш сервер (домен, пути, юзер, токены).
2. Установите `envsubst` (Ubuntu/Debian: `gettext-base`, macOS: `gettext`).
3. Сгенерируйте конфиги:

```bash
./deploy/render.sh
```

Файлы появятся в `deploy/out/`:
- `nginx.conf`
- `rooneyform.service`
- `rooneyform.env`
- `frontend.env.production`

Если вы меняете `APP_NAME`, имена файлов в `deploy/out/` будут другими.

## 1. Подготовка окружения

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.12 python3.12-venv nginx certbot python3-certbot-nginx git gettext-base
```

## 2. Установка проекта

```bash
sudo mkdir -p /var/www/rooneyform_app
sudo chown $USER:$USER /var/www/rooneyform_app
cd /var/www/rooneyform_app
git clone https://…/rooneyform_app.git .
python3.12 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
```

## 3. Указание API-адреса и сборка фронта

```bash
cp deploy/out/frontend.env.production frontend/.env.production
npm --prefix frontend run build
```

Папка `frontend/dist` содержит собранный SPA, а `backend/static` — фотографии.

## 4. Сервис для бекенда (systemd)

Используйте пути из `deploy/config.env` для копирования (или поменяйте имена файлов, если изменили `APP_NAME`):

```bash
sudo mkdir -p /etc/rooneyform
sudo cp deploy/out/rooneyform.env /etc/rooneyform/rooneyform.env
sudo cp deploy/out/rooneyform.service /etc/systemd/system/rooneyform.service

sudo systemctl daemon-reload
sudo systemctl enable --now rooneyform.service
```

## 5. Nginx + HTTPS

1. Создайте каталоги для сертификата:
   ```bash
   sudo mkdir -p /var/www/certbot
   ```
2. Скопируйте `deploy/out/nginx.conf` в `/etc/nginx/sites-available/rooneyform.conf` и поправьте пути, если отличны.
3. Активируйте сайт:
   ```bash
   sudo ln -s /etc/nginx/sites-available/rooneyform.conf /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Получите сертификат Let’s Encrypt (основной домен + API-домен):
   ```bash
   sudo certbot certonly --nginx -d rooneyform.store -d www.rooneyform.store -d api.rooneyform.store
   ```
   После успешного выпуска убедитесь, что в конфиге путей `ssl_certificate` и `ssl_certificate_key` указывают на `/etc/letsencrypt/live/rooneyform.store/…`.
5. Настройте автоматическое обновление:
   ```bash
   sudo systemctl enable certbot.timer
   sudo systemctl start certbot.timer
   ```

## 6. Обновление приложения

```
cd /var/www/rooneyform_app
git pull
source venv/bin/activate
pip install -r backend/requirements.txt
npm --prefix frontend install
./deploy/render.sh
cp deploy/out/frontend.env.production frontend/.env.production
npm --prefix frontend run build
sudo systemctl restart rooneyform.service
sudo systemctl reload nginx
```

Этого достаточно, чтобы домен `https://rooneyform.store/` отдавал фронтенд, а `https://api.rooneyform.store/` проксировался в FastAPI на порте 8000 (и раздавал `/static/` для изображений).

## 7. Автодеплой с локальной машины через git push

Идея: вы пушите в bare‑репозиторий на сервере, а `post-receive` хук выполняет сборку и рестарт сервиса.

### На сервере (Ubuntu 24.04, один раз)

1. Установите зависимости:
   ```bash
   sudo apt update
   sudo apt install -y git nginx certbot python3-certbot-nginx gettext-base nodejs npm python3.12 python3.12-venv
   ```
2. Создайте рабочую директорию и bare‑репозиторий:
   ```bash
   sudo mkdir -p /var/www/rooneyform_app
   sudo mkdir -p /opt/rooneyform.git
   sudo git init --bare /opt/rooneyform.git
   ```
3. Скопируйте хук:
   ```bash
   sudo cp /var/www/rooneyform_app/deploy/autodeploy/post-receive /opt/rooneyform.git/hooks/post-receive
   sudo chmod +x /opt/rooneyform.git/hooks/post-receive
   ```
4. Убедитесь, что в `deploy/config.env` на сервере корректные домены/пути (включая `API_DOMAIN` и `VITE_API_URL`).
5. Один раз вручную выпустите SSL сертификат (см. шаг 5 выше).

### На локальной машине

1. Добавьте SSH‑ключ на сервер (рекомендуется) и подключитесь:
   ```bash
   ssh root@62.217.180.175
   ```
2. Добавьте remote и пушьте:
   ```bash
   git remote add production root@62.217.180.175:/opt/rooneyform.git
   git push production main
   ```

После `git push` будет запущен `post-receive` хук — он соберет фронт, обновит зависимости и перезапустит сервисы.
