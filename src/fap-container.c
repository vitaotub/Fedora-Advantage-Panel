// ============================================================
// Fedora Advantage Panel (FAP) - Container WebKitGTK
// ============================================================

#include <gtk/gtk.h>
#include <webkit2/webkit2.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include <errno.h>

// ============================================================
// VERSÃO DO FAP
// ============================================================
//
// Definida pelo build via -DFAP_VERSION="..." (ver Makefile e
// build-container.sh). O #ifndef garante que uma compilação manual
// com gcc puro (sem a macro) ainda compile — o binário só mostra
// "unknown" na versão.
#ifndef FAP_VERSION
#define FAP_VERSION "unknown"
#endif

#define WINDOW_WIDTH 1280
#define WINDOW_HEIGHT 900
#define WINDOW_MIN_WIDTH 640
#define WINDOW_MIN_HEIGHT 480
#define APP_NAME "Fedora Advantage Panel"
#define DEFAULT_URL "http://localhost:3000"

typedef struct {
    GtkWidget *window;
    GtkWidget *webview;
    GtkWidget *header_bar;
    GtkWidget *spinner;
    GtkWidget *status_label;
    GtkWidget *progress_bar;
    char *url;
    char *icon_path;
    char *app_name;
    int window_width;
    int window_height;
    int debug_mode;
} AppData;

// ============================================================
// ÍCONE DA APLICAÇÃO
// ============================================================
void set_app_icon(GtkWindow *window, const char *icon_path) {
    if (icon_path && g_file_test(icon_path, G_FILE_TEST_EXISTS)) {
        gtk_window_set_icon_from_file(GTK_WINDOW(window), icon_path, NULL);
        g_print("[FAP] ✅ Ícone aplicado: %s\n", icon_path);

        GdkPixbuf *pixbuf = gdk_pixbuf_new_from_file(icon_path, NULL);
        if (pixbuf) {
            gtk_window_set_icon(GTK_WINDOW(window), pixbuf);
            g_object_unref(pixbuf);
        }
    } else {
        gtk_window_set_icon_name(GTK_WINDOW(window), "applications-utilities");
        g_print("[FAP] ⚠️ Ícone não encontrado: %s\n", icon_path ? icon_path : "(nenhum)");
    }
}

void atualizar_status(AppData *data, const char *mensagem, const char *estilo) {
    if (data->status_label) {
        char buffer[256];
        snprintf(buffer, sizeof(buffer), "<span %s>%s</span>", estilo ? estilo : "", mensagem);
        gtk_label_set_markup(GTK_LABEL(data->status_label), buffer);
    }
}

// ============================================================
// PERMISSÕES DA WEBVIEW
// ============================================================
//
// Negar automaticamente TODAS as solicitações de permissão que a
// página fizer (localização, câmera, microfone, notificações,
// clipboard, etc). Sem isso, o WebKitGTK exibe uma popup nativa
// pedindo autorização — e no caso da localização, o usuário vê
// uma janela do sistema perguntando se permite ou não o acesso.
//
// O FAP não precisa de NENHUMA dessas permissões: é uma UI de
// automação que roda local. Negar tudo é o comportamento correto
// e elimina o pop-up de localização que aparecia na primeira
// carga da página.
//
// Retornar TRUE diz ao WebKit que já tratamos o sinal — sem isso,
// ele pode emitir o padrão (mostrar a popup).
static gboolean on_permission_request(WebKitWebView *web_view,
                                      WebKitPermissionRequest *request,
                                      gpointer user_data) {
    (void)web_view;
    (void)user_data;

    const char *tipo = "desconhecida";

    if (WEBKIT_IS_GEOLOCATION_PERMISSION_REQUEST(request)) {
        tipo = "geolocalização";
    } else if (WEBKIT_IS_USER_MEDIA_PERMISSION_REQUEST(request)) {
        tipo = "mídia (câmera/microfone)";
    } else if (WEBKIT_IS_NOTIFICATION_PERMISSION_REQUEST(request)) {
        tipo = "notificações";
    } else if (WEBKIT_IS_CLIPBOARD_PERMISSION_REQUEST(request)) {
        tipo = "clipboard";
    }

    g_print("[FAP] 🚫 Permissão negada automaticamente: %s\n", tipo);

    webkit_permission_request_deny(request);
    return TRUE;
                                      }

                                      // ============================================================
                                      // CALLBACKS DA WEBVIEW
                                      // ============================================================
                                      void on_webview_load_changed(WebKitWebView *webview, WebKitLoadEvent load_event, gpointer user_data) {
                                          AppData *data = (AppData*)user_data;

                                          switch (load_event) {
                                              case WEBKIT_LOAD_STARTED:
                                                  if (data->spinner) {
                                                      gtk_widget_show(data->spinner);
                                                      gtk_spinner_start(GTK_SPINNER(data->spinner));
                                                  }
                                                  if (data->progress_bar) {
                                                      gtk_widget_show(data->progress_bar);
                                                      gtk_progress_bar_set_fraction(GTK_PROGRESS_BAR(data->progress_bar), 0.0);
                                                  }
                                                  atualizar_status(data, "⏳ Carregando...", "foreground='#60a5fa'");
                                                  g_print("[FAP] ⏳ Carregando página...\n");
                                                  break;

                                              case WEBKIT_LOAD_REDIRECTED:
                                                  atualizar_status(data, "🔄 Redirecionando...", "foreground='#f59e0b'");
                                                  break;

                                              case WEBKIT_LOAD_COMMITTED:
                                                  atualizar_status(data, "📄 Carregando conteúdo...", "foreground='#60a5fa'");
                                                  break;

                                              case WEBKIT_LOAD_FINISHED:
                                                  if (data->spinner) {
                                                      gtk_spinner_stop(GTK_SPINNER(data->spinner));
                                                      gtk_widget_hide(data->spinner);
                                                  }
                                                  if (data->progress_bar) {
                                                      gtk_progress_bar_set_fraction(GTK_PROGRESS_BAR(data->progress_bar), 1.0);
                                                      gtk_widget_hide(data->progress_bar);
                                                  }
                                                  atualizar_status(data, "✅ Pronto", "foreground='#34d399'");
                                                  g_print("[FAP] ✅ Página carregada com sucesso!\n");
                                                  break;

                                              default:
                                                  break;
                                          }
                                      }

                                      void on_webview_load_progress(WebKitWebView *webview, GParamSpec *pspec, gpointer user_data) {
                                          (void)pspec;
                                          AppData *data = (AppData*)user_data;
                                          if (data->progress_bar) {
                                              gdouble progress = webkit_web_view_get_estimated_load_progress(webview);
                                              gtk_progress_bar_set_fraction(GTK_PROGRESS_BAR(data->progress_bar), progress);
                                              char buffer[16];
                                              snprintf(buffer, sizeof(buffer), "%d%%", (int)(progress * 100));
                                              gtk_progress_bar_set_text(GTK_PROGRESS_BAR(data->progress_bar), buffer);
                                          }
                                      }

                                      gboolean on_webview_decide_policy(WebKitWebView *webview, WebKitPolicyDecision *decision,
                                                                        WebKitPolicyDecisionType type, gpointer user_data) {
                                          if (type == WEBKIT_POLICY_DECISION_TYPE_NAVIGATION_ACTION) {
                                              WebKitNavigationPolicyDecision *nav_decision = WEBKIT_NAVIGATION_POLICY_DECISION(decision);
                                              WebKitNavigationAction *action = webkit_navigation_policy_decision_get_navigation_action(nav_decision);
                                              WebKitURIRequest *request = webkit_navigation_action_get_request(action);
                                              const char *uri = webkit_uri_request_get_uri(request);

                                              g_print("[FAP] 🌐 Navegando para: %s\n", uri);

                                              if (g_str_has_prefix(uri, "http://localhost:") ||
                                                  g_str_has_prefix(uri, "http://127.0.0.1:") ||
                                                  g_str_has_prefix(uri, "file://") ||
                                                  g_str_has_prefix(uri, "about:")) {
                                                  webkit_policy_decision_use(decision);
                                              return TRUE;
                                                  }

                                                  g_print("[FAP] 🔗 Abrindo link externo: %s\n", uri);
                                                  gchar *quoted = g_shell_quote(uri);
                                                  gchar *cmd = g_strdup_printf("xdg-open %s", quoted);
                                                  g_spawn_command_line_async(cmd, NULL);
                                                  g_free(cmd);
                                                  g_free(quoted);
                                                  webkit_policy_decision_ignore(decision);
                                                  return TRUE;
                                          }
                                          return FALSE;
                                                                        }

                                                                        void on_webview_console_message(WebKitWebView *webview, const char *message,
                                                                                                        unsigned int line, const char *source_id,
                                                                                                        gpointer user_data) {
                                                                            AppData *data = (AppData*)user_data;
                                                                            if (data->debug_mode) {
                                                                                g_print("[FAP] 🐛 Console[%s:%d]: %s\n", source_id ? source_id : "???", line, message);
                                                                            }
                                                                                                        }

                                                                                                        // ============================================================
                                                                                                        // CALLBACKS DA JANELA
                                                                                                        // ============================================================
                                                                                                        void on_close(GtkWidget *widget, gpointer user_data) {
                                                                                                            (void)widget;
                                                                                                            (void)user_data;
                                                                                                            g_print("[FAP] 📦 Encerrando container...\n");
                                                                                                            gtk_main_quit();
                                                                                                        }

                                                                                                        gboolean on_window_delete(GtkWidget *widget, GdkEvent *event, gpointer user_data) {
                                                                                                            (void)event;
                                                                                                            on_close(widget, user_data);
                                                                                                            return FALSE;
                                                                                                        }

                                                                                                        gboolean on_window_key_press(GtkWidget *widget, GdkEventKey *event, gpointer user_data) {
                                                                                                            (void)widget;
                                                                                                            AppData *data = (AppData*)user_data;

                                                                                                            if ((event->state & GDK_CONTROL_MASK) && event->keyval == GDK_KEY_r) {
                                                                                                                webkit_web_view_reload(WEBKIT_WEB_VIEW(data->webview));
                                                                                                                return TRUE;
                                                                                                            }

                                                                                                            if (event->keyval == GDK_KEY_F5) {
                                                                                                                webkit_web_view_reload(WEBKIT_WEB_VIEW(data->webview));
                                                                                                                return TRUE;
                                                                                                            }

                                                                                                            if ((event->state & GDK_CONTROL_MASK) && (event->state & GDK_SHIFT_MASK) &&
                                                                                                                event->keyval == GDK_KEY_I) {
                                                                                                                WebKitWebInspector *inspector = webkit_web_view_get_inspector(WEBKIT_WEB_VIEW(data->webview));
                                                                                                            if (inspector) {
                                                                                                                webkit_web_inspector_show(inspector);
                                                                                                            }
                                                                                                            return TRUE;
                                                                                                                }

                                                                                                                if ((event->state & GDK_CONTROL_MASK) && event->keyval == GDK_KEY_q) {
                                                                                                                    on_close(NULL, user_data);
                                                                                                                    return TRUE;
                                                                                                                }

                                                                                                                return FALSE;
                                                                                                        }

                                                                                                        // ============================================================
                                                                                                        // CALLBACKS DOS BOTÕES DO HEADER BAR
                                                                                                        // ============================================================
                                                                                                        //
                                                                                                        // O sinal "clicked" de um GtkButton chama o callback com a
                                                                                                        // assinatura: callback(GtkButton *button, gpointer user_data).
                                                                                                        //
                                                                                                        // NÃO podemos conectar `webkit_web_view_reload` diretamente,
                                                                                                        // porque ele espera um único argumento (WebKitWebView *). O GTK
                                                                                                        // passaria o GtkButton como primeiro argumento e o user_data
                                                                                                        // (a webview) seria ignorado — resultado: o WebKit falha no
                                                                                                        // g_return_if_fail(WEBKIT_IS_WEB_VIEW) e o botão não faz nada.
                                                                                                        //
                                                                                                        // Solução: usar uma função wrapper que extrai a webview do
                                                                                                        // AppData e faz o cast correto.

                                                                                                        static void on_reload_clicked(GtkButton *button, gpointer user_data) {
                                                                                                            (void)button;
                                                                                                            AppData *data = (AppData*)user_data;
                                                                                                            if (data && data->webview) {
                                                                                                                webkit_web_view_reload(WEBKIT_WEB_VIEW(data->webview));
                                                                                                            }
                                                                                                        }

                                                                                                        static void on_inspect_clicked(GtkButton *button, gpointer user_data) {
                                                                                                            (void)button;
                                                                                                            AppData *data = (AppData*)user_data;
                                                                                                            if (data && data->webview) {
                                                                                                                WebKitWebInspector *inspector = webkit_web_view_get_inspector(WEBKIT_WEB_VIEW(data->webview));
                                                                                                                if (inspector) {
                                                                                                                    webkit_web_inspector_show(inspector);
                                                                                                                }
                                                                                                            }
                                                                                                        }

                                                                                                        // ============================================================
                                                                                                        // HEADER BAR
                                                                                                        // ============================================================
                                                                                                        void setup_header_bar(AppData *data) {
                                                                                                            data->header_bar = gtk_header_bar_new();
                                                                                                            gtk_header_bar_set_title(GTK_HEADER_BAR(data->header_bar),
                                                                                                                                     data->app_name ? data->app_name : APP_NAME);
                                                                                                            gtk_header_bar_set_show_close_button(GTK_HEADER_BAR(data->header_bar), TRUE);
                                                                                                            gtk_header_bar_set_decoration_layout(GTK_HEADER_BAR(data->header_bar),
                                                                                                                                                 "menu:minimize,maximize,close");

                                                                                                            gtk_window_set_titlebar(GTK_WINDOW(data->window), data->header_bar);

                                                                                                            data->spinner = gtk_spinner_new();
                                                                                                            gtk_widget_set_size_request(data->spinner, 20, 20);
                                                                                                            gtk_widget_hide(data->spinner);
                                                                                                            gtk_header_bar_pack_start(GTK_HEADER_BAR(data->header_bar), data->spinner);

                                                                                                            data->status_label = gtk_label_new(NULL);
                                                                                                            gtk_label_set_markup(GTK_LABEL(data->status_label), "<span foreground='#9ca3af'>Pronto</span>");
                                                                                                            gtk_widget_set_size_request(data->status_label, 120, -1);
                                                                                                            gtk_header_bar_pack_start(GTK_HEADER_BAR(data->header_bar), data->status_label);

                                                                                                            data->progress_bar = gtk_progress_bar_new();
                                                                                                            gtk_progress_bar_set_show_text(GTK_PROGRESS_BAR(data->progress_bar), TRUE);
                                                                                                            gtk_progress_bar_set_text(GTK_PROGRESS_BAR(data->progress_bar), "0%");
                                                                                                            gtk_widget_set_size_request(data->progress_bar, 80, 20);
                                                                                                            gtk_widget_hide(data->progress_bar);
                                                                                                            gtk_header_bar_pack_end(GTK_HEADER_BAR(data->header_bar), data->progress_bar);

                                                                                                            GtkWidget *reload_btn = gtk_button_new_from_icon_name("view-refresh", GTK_ICON_SIZE_MENU);
                                                                                                            gtk_button_set_relief(GTK_BUTTON(reload_btn), GTK_RELIEF_NONE);
                                                                                                            gtk_widget_set_tooltip_text(reload_btn, "Recarregar página (Ctrl+R)");
                                                                                                            g_signal_connect(reload_btn, "clicked", G_CALLBACK(on_reload_clicked), data);
                                                                                                            gtk_header_bar_pack_end(GTK_HEADER_BAR(data->header_bar), reload_btn);

                                                                                                            if (data->debug_mode) {
                                                                                                                GtkWidget *inspect_btn = gtk_button_new_from_icon_name("system-search", GTK_ICON_SIZE_MENU);
                                                                                                                gtk_button_set_relief(GTK_BUTTON(inspect_btn), GTK_RELIEF_NONE);
                                                                                                                gtk_widget_set_tooltip_text(inspect_btn, "Abrir inspecionador (Ctrl+Shift+I)");
                                                                                                                g_signal_connect(inspect_btn, "clicked", G_CALLBACK(on_inspect_clicked), data);
                                                                                                                gtk_header_bar_pack_end(GTK_HEADER_BAR(data->header_bar), inspect_btn);
                                                                                                            }

                                                                                                            GtkWidget *quit_btn = gtk_button_new_from_icon_name("window-close", GTK_ICON_SIZE_MENU);
                                                                                                            gtk_button_set_relief(GTK_BUTTON(quit_btn), GTK_RELIEF_NONE);
                                                                                                            gtk_widget_set_tooltip_text(quit_btn, "Sair (Ctrl+Q)");
                                                                                                            g_signal_connect(quit_btn, "clicked", G_CALLBACK(on_close), data);
                                                                                                            gtk_header_bar_pack_end(GTK_HEADER_BAR(data->header_bar), quit_btn);
                                                                                                        }

                                                                                                        // ============================================================
                                                                                                        // HANDLER DE SINAIS (async-signal-safe)
                                                                                                        // ============================================================
                                                                                                        //
                                                                                                        // Versão anterior fazia:
                                                                                                        //
                                                                                                        //   sa.sa_handler = (void(*)(int))gtk_main_quit;
                                                                                                        //
                                                                                                        // Isso é UB: `gtk_main_quit` NÃO é async-signal-safe — toca em
                                                                                                        // mutexes internos do GLib, aloca memória e dispara callbacks que
                                                                                                        // podem entrar em deadlock se o sinal chegou no meio de uma
                                                                                                        // operação do GLib (o caso mais comum, aliás).
                                                                                                        //
                                                                                                        // O padrão correto é: o handler apenas seta um flag atômico, e a
                                                                                                        // main loop (via g_idle_add) percebe e chama gtk_main_quit() no
                                                                                                        // contexto normal do GLib.
                                                                                                        //
                                                                                                        // `volatile sig_atomic_t` é o único tipo garantidamente seguro
                                                                                                        // para comunicação entre handler e código normal.

                                                                                                        static volatile sig_atomic_t _sinal_recebido = 0;

                                                                                                        static void _on_signal(int signum) {
                                                                                                            _sinal_recebido = signum;
                                                                                                        }

                                                                                                        static gboolean _checar_sinal(gpointer user_data) {
                                                                                                            (void)user_data;
                                                                                                            if (_sinal_recebido != 0) {
                                                                                                                g_print("[FAP] 📦 Sinal %d recebido. Encerrando...\n", (int)_sinal_recebido);
                                                                                                                gtk_main_quit();
                                                                                                                return G_SOURCE_REMOVE;
                                                                                                            }
                                                                                                            return G_SOURCE_CONTINUE;
                                                                                                        }

                                                                                                        // ============================================================
                                                                                                        // MAIN
                                                                                                        // ============================================================
                                                                                                        int main(int argc, char *argv[]) {
                                                                                                            gtk_init(&argc, &argv);

                                                                                                            char *url = DEFAULT_URL;
                                                                                                            char *icon_path = NULL;
                                                                                                            char *app_name = APP_NAME;
                                                                                                            int window_width = WINDOW_WIDTH;
                                                                                                            int window_height = WINDOW_HEIGHT;
                                                                                                            int min_width = WINDOW_MIN_WIDTH;
                                                                                                            int min_height = WINDOW_MIN_HEIGHT;
                                                                                                            int debug_mode = 0;

                                                                                                            for (int i = 1; i < argc; i++) {
                                                                                                                if (strcmp(argv[i], "--url") == 0 && i + 1 < argc) {
                                                                                                                    url = argv[++i];
                                                                                                                } else if (strcmp(argv[i], "--icon") == 0 && i + 1 < argc) {
                                                                                                                    icon_path = argv[++i];
                                                                                                                } else if (strcmp(argv[i], "--name") == 0 && i + 1 < argc) {
                                                                                                                    app_name = argv[++i];
                                                                                                                } else if (strcmp(argv[i], "--width") == 0 && i + 1 < argc) {
                                                                                                                    window_width = atoi(argv[++i]);
                                                                                                                } else if (strcmp(argv[i], "--height") == 0 && i + 1 < argc) {
                                                                                                                    window_height = atoi(argv[++i]);
                                                                                                                } else if (strcmp(argv[i], "--min-width") == 0 && i + 1 < argc) {
                                                                                                                    min_width = atoi(argv[++i]);
                                                                                                                } else if (strcmp(argv[i], "--min-height") == 0 && i + 1 < argc) {
                                                                                                                    min_height = atoi(argv[++i]);
                                                                                                                } else if (strcmp(argv[i], "--debug") == 0) {
                                                                                                                    debug_mode = 1;
                                                                                                                } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
                                                                                                                    printf("🐧 Fedora Advantage Panel - Container WebKitGTK v%s\n", FAP_VERSION);
                                                                                                                    printf("\nUso: %s [opções]\n", argv[0]);
                                                                                                                    printf("\nOpções:\n");
                                                                                                                    printf(" --url URL URL do servidor (padrão: http://localhost:3000)\n");
                                                                                                                    printf(" --icon CAMINHO Caminho do ícone da aplicação\n");
                                                                                                                    printf(" --name NOME Nome da aplicação (padrão: Fedora Advantage Panel)\n");
                                                                                                                    printf(" --width N Largura da janela (padrão: 1280)\n");
                                                                                                                    printf(" --height N Altura da janela (padrão: 900)\n");
                                                                                                                    printf(" --min-width N Largura mínima (padrão: 640)\n");
                                                                                                                    printf(" --min-height N Altura mínima (padrão: 480)\n");
                                                                                                                    printf(" --debug Modo debug\n");
                                                                                                                    printf(" --help, -h Mostra esta ajuda\n");
                                                                                                                    printf("\nAtalhos:\n");
                                                                                                                    printf(" Ctrl+R / F5 Recarregar página\n");
                                                                                                                    printf(" Ctrl+Shift+I Abrir inspecionador\n");
                                                                                                                    printf(" Ctrl+Q Sair\n");
                                                                                                                    printf("\n");
                                                                                                                    return 0;
                                                                                                                }
                                                                                                            }

                                                                                                            AppData data;
                                                                                                            data.url = url;
                                                                                                            data.icon_path = icon_path;
                                                                                                            data.app_name = app_name;
                                                                                                            data.window_width = window_width;
                                                                                                            data.window_height = window_height;
                                                                                                            data.debug_mode = debug_mode;
                                                                                                            data.webview = NULL;
                                                                                                            data.header_bar = NULL;
                                                                                                            data.spinner = NULL;
                                                                                                            data.status_label = NULL;
                                                                                                            data.progress_bar = NULL;

                                                                                                            // ============================================================
                                                                                                            // CORREÇÃO ÍCONE (KDE) — Definir identidade ANTES de criar a janela
                                                                                                            // ============================================================
                                                                                                            // O WM_CLASS da janela (lido pelo KDE para associar ícone) é
                                                                                                            // montado a partir de duas partes: resname (minúscula) e resclass.
                                                                                                            // O GTK3 decide o resname com base em:
                                                                                                            // 1. g_set_prgname() — se chamado, tem precedência
                                                                                                            // 2. g_get_prgname() — derivado do argv[0] se (1) não foi chamado
                                                                                                            // O resclass é definido por gtk_window_set_wmclass().
                                                                                                            //
                                                                                                            // O problema anterior: setávamos wmclass como "fap-container", mas
                                                                                                            // em seguida g_set_prgname("fedora-advantage-panel") sobrescrevia o
                                                                                                            // resname. Resultado: WM_CLASS = ("fedora-advantage-panel", "fap-container"),
                                                                                                            // que não bate com o StartupWMClass=fap-container do .desktop, e o
                                                                                                            // KDE caía no ícone padrão do toolkit (o "W" amarelo).
                                                                                                            //
                                                                                                            // Agora: prgname = "fap-container" (bate com StartupWMClass) e
                                                                                                            // wmclass = "fap-container" (bate com hicolor/fap-container.png).
                                                                                                            g_set_prgname("fap-container");
                                                                                                            g_set_application_name(app_name);

                                                                                                            data.window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
                                                                                                            gtk_window_set_title(GTK_WINDOW(data.window), app_name);
                                                                                                            gtk_window_set_default_size(GTK_WINDOW(data.window), window_width, window_height);
                                                                                                            gtk_window_set_position(GTK_WINDOW(data.window), GTK_WIN_POS_CENTER);
                                                                                                            gtk_window_set_resizable(GTK_WINDOW(data.window), TRUE);

                                                                                                            // Tamanho mínimo: abaixo disso o layout quebra (sidebar + conteúdo + log dock
                                                                                                            // não caberiam lado a lado). A janela continua redimensionável — só não desce
                                                                                                            // abaixo dos limites.
                                                                                                            GdkGeometry min_hints;
                                                                                                            min_hints.min_width = min_width;
                                                                                                            min_hints.min_height = min_height;
                                                                                                            gtk_window_set_geometry_hints(GTK_WINDOW(data.window), NULL, &min_hints, GDK_HINT_MIN_SIZE);

                                                                                                            // Reforça o WM_CLASS (resname, resclass). O resname aqui é redundante
                                                                                                            // com o g_set_prgname acima, mas garante em qualquer versão do GTK.
                                                                                                            gtk_window_set_wmclass(GTK_WINDOW(data.window), "fap-container", "fap-container");

                                                                                                            set_app_icon(GTK_WINDOW(data.window), icon_path);

                                                                                                            // ============================================================
                                                                                                            // NULL CHECKS
                                                                                                            // ============================================================
                                                                                                            //
                                                                                                            // `webkit_settings_new()` retorna NULL apenas se o backend
                                                                                                            // WebKitGTK estiver completamente quebrado (build sem
                                                                                                            // implementação, biblioteca incompatível). Na prática não
                                                                                                            // acontece, mas o check evita um segfault obscuro no
                                                                                                            // `webkit_settings_set_*` logo abaixo se acontecer.
                                                                                                            WebKitSettings *settings = webkit_settings_new();
                                                                                                            if (!settings) {
                                                                                                                g_printerr("[FAP] ❌ Falha ao criar WebKitSettings. Abortando.\n");
                                                                                                                return 1;
                                                                                                            }

                                                                                                            webkit_settings_set_enable_developer_extras(settings, debug_mode);
                                                                                                            webkit_settings_set_enable_javascript(settings, TRUE);
                                                                                                            webkit_settings_set_enable_webaudio(settings, FALSE);
                                                                                                            webkit_settings_set_allow_file_access_from_file_urls(settings, TRUE);
                                                                                                            webkit_settings_set_enable_media_stream(settings, TRUE);
                                                                                                            webkit_settings_set_enable_page_cache(settings, TRUE);
                                                                                                            webkit_settings_set_enable_smooth_scrolling(settings, TRUE);
                                                                                                            webkit_settings_set_enable_back_forward_navigation_gestures(settings, FALSE);
                                                                                                            webkit_settings_set_user_agent(settings,
                                                                                                                                           "Mozilla/5.0 (Fedora Advantage Panel; Linux) AppleWebKit/605.1.15 (KHTML, like Gecko)");

                                                                                                            data.webview = webkit_web_view_new_with_settings(settings);
                                                                                                            g_object_unref(settings);

                                                                                                            // `webkit_web_view_new_with_settings` retorna NULL se o contexto
                                                                                                            // WebKit não puder ser criado (disco cheio, /tmp sem permissão,
                                                                                                            // sandbox bloqueando). Sem o check, os `g_signal_connect` abaixo
                                                                                                            // passariam NULL e o GTK abortaria com "invalid cast".
                                                                                                            if (!data.webview) {
                                                                                                                g_printerr("[FAP] ❌ Falha ao criar WebKitWebView. Verifique /tmp e o sandbox.\n");
                                                                                                                return 1;
                                                                                                            }

                                                                                                            g_signal_connect(data.webview, "load-changed",
                                                                                                                             G_CALLBACK(on_webview_load_changed), &data);
                                                                                                            g_signal_connect(data.webview, "notify::estimated-load-progress",
                                                                                                                             G_CALLBACK(on_webview_load_progress), &data);
                                                                                                            g_signal_connect(data.webview, "decide-policy",
                                                                                                                             G_CALLBACK(on_webview_decide_policy), &data);

                                                                                                            // ============================================================
                                                                                                            // NEGAÇÃO AUTOMÁTICA DE PERMISSÕES
                                                                                                            // ============================================================
                                                                                                            //
                                                                                                            // Sem este handler, o WebKitGTK exibe uma popup nativa pedindo
                                                                                                            // autorização sempre que a página solicita localização, câmera,
                                                                                                            // microfone, notificações ou clipboard. O FAP não precisa de
                                                                                                            // nenhuma dessas permissões — é uma UI de automação local.
                                                                                                            //
                                                                                                            // Ao negar todas automaticamente, o pop-up de localização que
                                                                                                            // aparecia na primeira carga é eliminado.
                                                                                                            g_signal_connect(data.webview, "permission-request",
                                                                                                                             G_CALLBACK(on_permission_request), &data);

                                                                                                            if (debug_mode) {
                                                                                                                g_signal_connect(data.webview, "console-message",
                                                                                                                                 G_CALLBACK(on_webview_console_message), &data);
                                                                                                            }

                                                                                                            webkit_web_view_load_uri(WEBKIT_WEB_VIEW(data.webview), url);

                                                                                                            gtk_widget_set_hexpand(data.webview, TRUE);
                                                                                                            gtk_widget_set_vexpand(data.webview, TRUE);
                                                                                                            gtk_container_add(GTK_CONTAINER(data.window), data.webview);

                                                                                                            setup_header_bar(&data);

                                                                                                            g_signal_connect(data.window, "destroy", G_CALLBACK(on_close), &data);
                                                                                                            g_signal_connect(data.window, "delete-event", G_CALLBACK(on_window_delete), &data);
                                                                                                            g_signal_connect(data.window, "key-press-event", G_CALLBACK(on_window_key_press), &data);

                                                                                                            gtk_widget_show_all(data.window);

                                                                                                            // ============================================================
                                                                                                            // SINAIS — HANDLER ASYNC-SIGNAL-SAFE
                                                                                                            // ============================================================
                                                                                                            //
                                                                                                            // O handler APENAS seta um flag atômico. O `g_timeout_add`
                                                                                                            // abaixo checa esse flag a cada 100ms (na main loop, contexto
                                                                                                            // GLib normal) e dispara `gtk_main_quit` com segurança.
                                                                                                            //
                                                                                                            // Antes, `sa.sa_handler = gtk_main_quit` era UB: o GLib toca
                                                                                                            // mutexes internos dentro do handler, e se o sinal chegasse
                                                                                                            // no meio de uma operação do próprio GLib, podia dar deadlock.
                                                                                                            struct sigaction sa;
                                                                                                            sa.sa_handler = _on_signal;
                                                                                                            sigemptyset(&sa.sa_mask);
                                                                                                            sa.sa_flags = 0;
                                                                                                            sigaction(SIGINT, &sa, NULL);
                                                                                                            sigaction(SIGTERM, &sa, NULL);

                                                                                                            g_timeout_add(100, _checar_sinal, NULL);

                                                                                                            g_print("============================================================\n");
                                                                                                            g_print(" 🐧 Fedora Advantage Panel - Container WebKitGTK %s\n", FAP_VERSION);
                                                                                                            g_print("============================================================\n");
                                                                                                            g_print(" 🌐 URL: %s\n", url);
                                                                                                            g_print(" 📐 Janela: %dx%d (mín: %dx%d)\n", window_width, window_height, min_width, min_height);
                                                                                                            g_print(" 🐛 Debug: %s\n", debug_mode ? "Ativado" : "Desativado");
                                                                                                            g_print(" 🚫 Permissões: negadas automaticamente (localização, câmera, microfone, notificações, clipboard)\n");
                                                                                                            g_print("============================================================\n");

                                                                                                            gtk_main();

                                                                                                            g_print("[FAP] 👋 Encerrado!\n");
                                                                                                            return 0;
                                                                                                        }
