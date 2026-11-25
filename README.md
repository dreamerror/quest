# Кассета для мамы

Сайт работает на GitHub Pages, а вход и выдачу PDF проверяет Cloudflare Worker. Перед запуском настройте Worker и его адрес в `assets/config.js` по инструкции ниже. Для локального запуска сайта выполните `python -m http.server 8000` из папки проекта и откройте http://localhost:8000.

## Треки

Реестр треков находится в `assets/quest.js`. Чтобы добавить игру, реализуйте её в `assets/games.js` и добавьте в реестр запись с уникальным `id`, названием, подписью и функцией `mount(container, { avatar, complete })`. Функция `avatar()` возвращает текущий аватар. Вызов `complete()` сохраняет прохождение трека. Игра может вернуть методы `refreshAvatar` для обновления аватара и `dispose` для остановки таймеров или анимаций при выходе.

Сторона Б открывается после прохождения всех треков из реестра. Аватар, прогресс и открытие приза сохраняются в браузере. После открытия скретча браузер получает PDF из защищённого API. Прохождение игр проверяется на клиенте, доступ к PDF проверяется на сервере по приглашению.

## GitHub Pages

1. Создайте репозиторий на GitHub и загрузите проект в ветку `main`.
2. В настройках репозитория откройте **Settings → Pages** и выберите **GitHub Actions** как источник публикации.
3. Запустите **Publish to GitHub Pages** из вкладки **Actions**. Дальше он будет запускаться при каждом push в `main`. Ссылка появится в окружении `github-pages`.

В артефакт публикации попадают `index.html` и папка `assets`. Пути к ресурсам относительные, поэтому сайт работает и по адресу вида `https://имя.github.io/репозиторий/`.

## Настройка сертификата PDF и приглашения

### 1. Создайте бесплатное хранилище KV

Используется Cloudflare Workers Free и Workers KV. Для старта Workers карта не требуется. KV включён в бесплатный план. Максимальный размер одного PDF — 25 МиБ, доступное хранилище — 1 ГБ.

В PowerShell выполните:

```powershell
Set-Location C:\Projects\quest\server
npx wrangler login
npx wrangler kv namespace create CERTIFICATES
```

Скопируйте полученный `id` в `server/wrangler.jsonc`, в `kv_namespaces[0].id`, вместо `REPLACE_WITH_KV_NAMESPACE_ID`. Если команда предложила обновить конфигурацию автоматически, проверьте, что в ней одна запись с `binding: "CERTIFICATES"` и полученным id.

Загрузите PDF из файла вне проекта:

```powershell
npx wrangler kv key put certificate.pdf --binding CERTIFICATES --path "C:\path\outside-project\certificate.pdf" --remote
```

Замените путь на настоящий путь к вашему PDF. Параметр `--remote` отправляет файл в Cloudflare. Значение сохраняется в KV под ключом `certificate.pdf` и доступно через защищённый Worker.

PDF храните на своём компьютере за пределами проекта. В `.gitignore` уже добавлены PDF, `private/`, файлы env и локальные данные Wrangler. Это исключает новые файлы из обычного добавления в Git, но не удаляет файлы, которые ранее уже были закоммичены. В артефакт Pages включаются только файлы сайта.

### 2. Настройте Worker

В `server/wrangler.jsonc` укажите:

- `SITE_ORIGIN` — адрес сайта до первого слеша после домена, например `https://my-login.github.io`. Название репозитория в этот параметр не входит. Для собственного домена укажите его origin.
- `CERTIFICATE_KEY` — ключ загруженного PDF, например `certificate.pdf`.
- `kv_namespaces[0].id` — id созданного пространства KV, `binding` должен оставаться `CERTIFICATES`.

Откройте PowerShell и выполните:

```powershell
Set-Location C:\Projects\quest\server
npx wrangler login
npx wrangler deploy
```

При первом запуске npx предложит установить Wrangler. Команда login откроет вход в Cloudflare. После deploy сохраните адрес вида `https://cassette-certificate.your-subdomain.workers.dev`. До добавления секрета API отвечает ошибкой настройки и закрывает доступ.

### 3. Задайте секрет в env

Сгенерируйте случайное значение локально, например:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Сохраните это значение у себя. В production выполните из папки `server`:

```powershell
npx wrangler secret put INVITE_TOKEN
```

Вставьте значение в интерактивный запрос команды. Его также можно добавить в Cloudflare Dashboard в настройках Worker, **Variables and Secrets**, имя `INVITE_TOKEN`, тип **Secret**, затем применить изменения. Секрет доступен Worker как `env.INVITE_TOKEN`.

Для локального Worker скопируйте `server/.env.example` в `server/.env` и запишите:

```dotenv
INVITE_TOKEN=ваше-случайное-значение
```

Локальный `.env` автоматически читается при `npx wrangler dev`. Production получает значение через Worker Secret. Загрузка `.env` в GitHub Secrets или добавление значения в frontend не требуется.

### 4. Подключите сайт

В `assets/config.js` укажите публичный адрес Worker:

```javascript
window.QUEST_API_URL = "https://cassette-certificate.your-subdomain.workers.dev";
```

Загрузите изменения сайта в GitHub и дождитесь публикации Pages. Адрес API можно хранить в репозитории. `INVITE_TOKEN` остаётся только в env Worker и в персональной ссылке.

### 5. Составьте ссылку для мамы

```text
https://my-login.github.io/quest/?invite=ваше-случайное-значение
```

Для случайной hex-строки из команды выше дополнительное кодирование не нужно. Если используете другой пароль, значение параметра нужно URL-кодировать.

При открытии сайт извлекает `invite`, удаляет его из адресной строки и отправляет API в заголовке Authorization. После успешной проверки он хранится в sessionStorage текущей вкладки. Обновление страницы сохраняет вход в этой вкладке. Для новой сессии используйте исходную ссылку.

Мама проходит игры и стирает скретч. После этого сайт получает PDF и показывает **Открыть PDF** и **Скачать сертификат**. Файл передаётся через Worker с `Cache-Control: no-store`. При ошибке загрузку можно повторить.

### 6. Проверьте перед подарком

- Откройте сайт в приватном окне без `invite`, затем с неправильным значением. Вход должен оставаться закрытым.
- Откройте правильное приглашение. Параметр должен исчезнуть, а кассета стать доступной.
- Для проверки PDF без повторного прохождения можно в DevTools браузера выполнить строку ниже и обновить страницу. После проверки очистите данные сайта в браузере, которым будет пользоваться мама.

```javascript
const progress = JSON.parse(localStorage.getItem("cassette-for-mom-v1") || "{}");
progress.completed = ["catcher", "packing", "marbles", "match3"];
localStorage.setItem("cassette-for-mom-v1", JSON.stringify(progress));
location.reload();
```

Откройте сторону Б, сотрите покрытие, скачайте PDF и проверьте его содержимое. Также убедитесь, что прямой запрос к `https://ваш-worker/api/certificate` без заголовка Authorization получает 401.

### Замена PDF и отзыв приглашения

Для замены сертификата повторите команду `npx wrangler kv key put certificate.pdf --binding CERTIFICATES --path "C:\path\outside-project\certificate.pdf" --remote` с новым PDF. Повторная сборка сайта не требуется. Изменение KV может распространяться до минуты и дольше, поэтому проверяйте замену заранее. Для отзыва доступа задайте новое значение `INVITE_TOKEN` командой `npx wrangler secret put INVITE_TOKEN` и составьте новую ссылку.

Приглашение даёт доступ любому, у кого есть полная ссылка. Автоматического срока действия и одноразового погашения в этой реализации нет. GET-параметр может попасть в историю, синхронизацию браузера, сервисы сообщений и журналы хостинга до того, как сайт его удалит. Передавайте приглашение лично. Уже скачанный PDF можно сохранить и переслать.

### Локальная проверка

В `server/wrangler.jsonc` временно укажите `SITE_ORIGIN` равным `http://localhost:8000`, а в `assets/config.js` — `http://localhost:8787`. Из папки `server` запустите `npx wrangler dev` с заполненным `server/.env`. Локальный KV имеет отдельные данные. Для загрузки PDF в локальный KV выполните из папки `server`:

```powershell
npx wrangler kv key put certificate.pdf --binding CERTIFICATES --path "C:\path\outside-project\certificate.pdf" --local
```

В другом терминале запустите `python -m http.server 8000` из корня проекта и откройте `http://localhost:8000/?invite=ваше-значение`. Перед production deploy верните origin GitHub Pages и production URL API.

Документация Cloudflare:

- Бесплатный старт Workers — https://www.cloudflare.com/products/workers/
- Бесплатные лимиты KV — https://developers.cloudflare.com/kv/platform/pricing/
- Максимальный размер файла — https://developers.cloudflare.com/kv/platform/limits/
- Загрузка файла в KV — https://developers.cloudflare.com/workers/wrangler/commands/kv/
- Локальный env — https://developers.cloudflare.com/workers/local-development/environment-variables/
