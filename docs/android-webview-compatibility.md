# Совместимость SHOWDOWN с Android WebView

## Поддерживаемая матрица

| Android | Минимальный WebView для проверки | Режим сборки |
| --- | --- | --- |
| 8 | Chromium 61 | legacy/SystemJS + polyfills |
| 9 | Chromium 69 | legacy/SystemJS + polyfills |
| 10 | Chromium 74 | legacy/SystemJS + polyfills |
| Современный Android | Chromium 105+ | native module bundle |

Нижняя граница проекта — Chrome/ChromeAndroid 61. Android System WebView может
обновляться независимо от Android, поэтому фактическая версия WebView важнее
версии операционной системы.

## Сборка

- `build.target` и `build.cssTarget` явно заданы как `chrome61`.
- Официальный `@vitejs/plugin-legacy` создаёт отдельные SystemJS-чанки для
  Chrome/ChromeAndroid 61+ и автоматически добавляет используемые ES-polyfill’ы.
- `core-js/proposals/global-this` добавлен явно, чтобы старый WebView не
  использовал динамический `Function` из `regenerator-runtime`.
- Современные браузеры продолжают получать меньший module-bundle; legacy-файлы
  загружаются только при провале встроенной проверки возможностей браузера.

`plugin-legacy` управляет окончательной целью modern-чанков и сообщает об этом
предупреждением при сборке. Минимальная версия старого WebView определяется
параметром `targets`, а наличие обоих вариантов контролируется автоматически.

## Fallback запуска

До загрузки React в `index.html` работает небольшой ES5-watchdog. Он не зависит
от основного bundle и показывает экран восстановления, если:

- JavaScript-файл не загрузился;
- React не подтвердил первый успешный commit за 12 секунд;
- JavaScript отключён полностью.

Экран предлагает повторить загрузку и обновить Android System WebView/Chrome.
После успешного commit React удаляет fallback из DOM.

## Автоматическая проверка

```text
npm test
npm run build
npm run build:pages
```

`scripts/check-android-build.mjs` проверяет итоговый, а не исходный HTML:

- modern `type=module` entry;
- legacy `nomodule` entry;
- SystemJS application chunks и polyfills;
- существование всех JS/CSS-файлов по ссылкам;
- наличие ES5-safe watchdog и сигнала успешного запуска React.

Функциональный smoke-test на каждой физической версии должен включать запуск из
Telegram и Chrome, OTP-вход, загрузку турниров и магазина, переход по прямой
ссылке и повторный запуск после очистки кэша. Для воспроизводимого отчёта нужно
указывать не только Android, но и версию Android System WebView.
