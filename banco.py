"""
Banco Santa Fe — homebanking: login automático + extracción de movimientos.

Todo en un solo módulo para poder importarlo después desde un backend web
(ej. Flask/FastAPI) y mostrar los movimientos en una página.

Contiene datos financieros tuyos cuando corre: los JSON que genera no se
suben a ningún lado público.

Comandos de consola:
    python banco.py guardar-credenciales   -> guarda usuario/clave (una vez)
    python banco.py extraer                 -> loguea y baja movimientos a JSON
    python banco.py explorar                 -> navegás a mano y queda un log de
                                                 todas las llamadas (debug, por si
                                                 el banco cambia algo)

Uso como librería (para el futuro backend web):
    from banco import obtener_movimientos
    movimientos = obtener_movimientos()   # lista de dicts lista para mostrar
"""
import argparse
import datetime
import getpass
import hashlib
import json
import os
import re
import sys
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import keyring
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

SERVICIO = "bancosantafe_homebanking"
CUENTA = "credenciales"
URL_LOGIN = "https://digital.bancosantafe.ar/loginStep1"
API = "https://ap01.bancosantafe.ar/api/v1/execute"
CUOTA_RE = re.compile(r"\s+(\d{1,2}/\d{1,2})$")
PAUSA_ENTRE_PAGINAS = 0.4  # segundos, para no ametrallar la API del banco


# ---------------------------------------------------------------- credenciales


def guardar_credenciales():
    usuario = input("Usuario del homebanking: ").strip()
    clave = getpass.getpass("Clave (no se muestra en pantalla): ")
    keyring.set_password(SERVICIO, CUENTA, usuario + "\n" + clave)
    del clave
    print("Guardado en el Windows Credential Manager.")
    print("Ya podés correr: python banco.py extraer")


def cargar_credenciales():
    guardadas = keyring.get_password(SERVICIO, CUENTA)
    if not guardadas:
        print("No hay credenciales guardadas todavía.")
        print("Corré primero: python banco.py guardar-credenciales")
        sys.exit(1)
    usuario, clave = guardadas.split("\n", 1)
    return usuario, clave


# ----------------------------------------------------------------------- login


def auto_login(page, usuario: str, clave: str) -> bool:
    """Completa el login paso a paso. Devuelve True si parece haber llegado
    más allá de la pantalla de clave. Si algo no matchea (el banco cambió el
    formulario, pidió un paso extra, etc.) avisa y deja que sigas a mano."""
    try:
        page.fill("#username", usuario, timeout=15000)
        page.get_by_text("Continuar", exact=True).first.click(timeout=10000)
    except PWTimeout:
        print(">>> No encontré el campo de usuario o el botón 'Continuar'. Completalo a mano.")
        return False

    try:
        page.wait_for_selector("#password", timeout=15000)
        page.fill("#password", clave)
        page.get_by_text("Ingresar", exact=True).first.click(timeout=10000)
    except PWTimeout:
        print(">>> No encontré el campo de clave o el botón 'Ingresar'. Completalo a mano.")
        return False

    # Puede venir un paso extra (token, captcha, pregunta de seguridad).
    page.wait_for_timeout(2000)
    if "login" in page.url.lower():
        print(">>> Parece que el banco pide un paso extra (token/captcha/pregunta).")
        print(">>> Completalo a mano en la ventana del navegador.")
        return False

    print(">>> Login automático OK.")
    return True


def cerrar_popups(page):
    """Cierra avisos/modales que suelen aparecer después de loguear
    (ej. 'Vincular Token Virtual'). Si no aparece ninguno, no hace nada."""
    try:
        page.locator('button[data-bc="btn_close"]').first.click(timeout=5000)
        print(">>> Cerré un popup post-login.")
    except PWTimeout:
        pass


def iniciar_sesion(ctx):
    """Abre una página nueva en el contexto dado, loguea y devuelve la página."""
    page = ctx.new_page()
    page.goto(URL_LOGIN)
    usuario, clave = cargar_credenciales()
    auto_login(page, usuario, clave)
    del clave
    cerrar_popups(page)
    try:
        page.screenshot(path="debug_ultimo_login.png", full_page=True)
        Path("debug_ultimo_login.html").write_text(page.content(), encoding="utf-8")
    except Exception:
        pass
    return page


# ------------------------------------------------------------------ extracción


def preparar_captura_bc(ctx) -> dict:
    """Engancha un listener ANTES del login que agarra _bcCuil / xAppVersion
    de la primera llamada EXITOSA a widgets.accounts que haga la propia
    página, venga cuando venga (durante el login, al cargar el dashboard,
    etc). Si esperáramos a enganchar el listener después del login,
    corremos el riesgo de que esa llamada ya haya pasado y nos la
    perdamos (nos pasó: el dashboard cargaba tan rápido que ya tenía los
    saldos pintados cuando recién empezábamos a escuchar).

    Devuelve un dict vacío que se va a ir llenando solo en segundo plano;
    hay que esperarlo con esperar_bc(). No son secretos de tu cuenta: es
    un identificador de este navegador."""
    hallado = {}
    hallado["_fallidas"] = []

    def on_resp(resp):
        if "_bcCuil" in hallado or "widgets.accounts" not in resp.url:
            return
        try:
            datos = resp.request.post_data_json
        except Exception:
            datos = None
        if resp.status == 200 and isinstance(datos, dict) and "_bcCuil" in datos:
            hallado["_bcCuil"] = datos["_bcCuil"]
            hallado["xAppVersion"] = datos.get("xAppVersion", "2.05.1")
            hallado["authorization"] = resp.request.all_headers().get("authorization")
        elif resp.status != 200:
            hallado["_fallidas"].append(resp.status)

    ctx.on("response", on_resp)
    return hallado


def esperar_bc(page, hallado: dict, espera_ms=20000, paso_ms=500) -> dict:
    transcurrido = 0
    while "_bcCuil" not in hallado and transcurrido < espera_ms:
        page.wait_for_timeout(paso_ms)
        transcurrido += paso_ms

    if "_bcCuil" not in hallado:
        if hallado["_fallidas"]:
            raise RuntimeError(
                f"La propia página llamó a widgets.accounts y le respondió {hallado['_fallidas'][-1]}. "
                "La sesión no quedó activa del todo (¿falta completar algo del token en el navegador?)."
            )
        raise RuntimeError(
            "No vi que la página llamara a widgets.accounts. "
            "¿El login automático falló o el banco cambió algo?"
        )
    if not hallado.get("authorization"):
        raise RuntimeError("Vi la llamada a widgets.accounts pero no tenía header Authorization.")
    return hallado


def cuerpo(bc: dict, **extra) -> dict:
    d = {"_bcCuil": bc["_bcCuil"], "ajax_uuid": str(uuid.uuid4()), "xAppVersion": bc["xAppVersion"]}
    d.update(extra)
    return d


def pedir(pw_page, bc: dict, endpoint: str, **campos) -> dict:
    """Ejecuta el POST con fetch() desde ADENTRO de la página (no con un
    cliente HTTP aparte), para heredar cookies, y le agrega a mano el
    header Authorization con el token que le copiamos a una llamada real
    (sin eso el banco devuelve 401 aunque el resto esté bien)."""
    body = cuerpo(bc, **campos)
    headers = {
        "Content-Type": "application/json;charset=UTF-8",
        "Authorization": bc["authorization"],
        "ajax_uuid": body["ajax_uuid"],
    }
    resultado = pw_page.evaluate(
        """async ([url, body, headers]) => {
            const resp = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers,
                body: JSON.stringify(body),
            });
            return { status: resp.status, texto: await resp.text() };
        }""",
        [f"{API}/{endpoint}", body, headers],
    )
    if resultado["status"] != 200:
        raise RuntimeError(f"{endpoint} devolvió {resultado['status']}: {resultado['texto'][:300]}")
    return json.loads(resultado["texto"])["data"]


def listar_cuentas(page, bc):
    return pedir(page, bc, "widgets.accounts")["accounts"]


def listar_tarjetas(page, bc):
    return pedir(page, bc, "widgets.creditCards")["creditCards"]


def fecha_item(cadena: str) -> datetime.date:
    return datetime.date.fromisoformat(cadena[:10])


def inicio_mes_actual() -> datetime.date:
    hoy = datetime.date.today()
    return hoy.replace(day=1)


def id_estable(*partes) -> str:
    """Id determinístico (mismos datos de entrada -> mismo id siempre), para
    que la web pueda hacer upsert sin duplicar un movimiento ya importado
    cuando corremos la extracción de nuevo."""
    crudo = "|".join(str(p) for p in partes)
    return hashlib.md5(crudo.encode("utf-8")).hexdigest()[:16]


def movimientos_cuenta(page, bc, cuenta: dict, desde: datetime.date = None, max_paginas=200) -> list:
    """Baja movimientos, de más nuevo a más viejo, y corta en cuanto
    aparece uno anterior a 'desde' (no sigue pidiendo páginas de más)."""
    movs = []
    pagina = 1
    while pagina <= max_paginas:
        datos = pedir(
            page,
            bc,
            "accounts.listStatements",
            page=pagina,
            idProduct=cuenta["idProduct"],
            balance=cuenta.get("balance", 0),
            amountToCalculate=0,
            all=True,
        )
        lista = datos["paginatedData"]["paginatedList"]
        llegamos_al_limite = False
        for item in lista["elementList"]:
            if desde and fecha_item(item["date"]) < desde:
                llegamos_al_limite = True
                break
            monto = item["debit"] if item["debit"] is not None else item["credit"]
            voucher = item.get("voucher")
            movs.append(
                {
                    "id": f"cuenta:{cuenta['idProduct']}:{voucher}"
                    if voucher
                    else f"cuenta:{cuenta['idProduct']}:{id_estable(item['date'], item['concept'], monto)}",
                    "fecha": item["date"],
                    "descripcion": (item["concept"] or "").strip(),
                    "monto": monto,
                    "moneda": item["accountCurrency"],
                    "origen": cuenta.get("shortLabel"),
                    "cuotas": None,
                    "comprobante": voucher,
                }
            )
        if llegamos_al_limite or not lista["elementList"] or pagina >= lista["totalPages"]:
            break
        pagina += 1
        time.sleep(PAUSA_ENTRE_PAGINAS)
    return movs


def movimientos_tarjeta(page, bc, tarjeta: dict, desde: datetime.date = None, max_paginas=60) -> list:
    movs = []
    for pagina in range(1, max_paginas + 1):
        datos = pedir(
            page,
            bc,
            "creditCard.listMovements",
            idProduct=tarjeta["idProduct"],
            page=pagina,
        )
        lista = datos.get("list") or []
        if not lista:
            break
        llegamos_al_limite = False
        for item in lista:
            if desde and fecha_item(item["date"]) < desde:
                llegamos_al_limite = True
                break
            concepto = item.get("concept") or ""
            m = CUOTA_RE.search(concepto)
            cuotas = m.group(1) if m else None
            descripcion = CUOTA_RE.sub("", concepto).strip() if m else concepto
            # El banco reporta un consumo como monto POSITIVO (aumenta la deuda)
            # y un pago como NEGATIVO (la baja). Esta app usa la convención
            # contraria (positivo = ingreso, negativo = gasto), así que se
            # invierte el signo acá.
            monto = -item.get("amount") if item.get("amount") is not None else None
            movs.append(
                {
                    "id": f"tarjeta:{tarjeta['idProduct']}:{id_estable(item['date'], concepto, item.get('amount'))}",
                    "fecha": item["date"],
                    "descripcion": descripcion,
                    "monto": monto,
                    "moneda": item.get("sourceAmountCurrency"),
                    "origen": tarjeta.get("shortLabel"),
                    "cuotas": cuotas,
                    "comprobante": None,
                }
            )
        if llegamos_al_limite:
            break
        time.sleep(PAUSA_ENTRE_PAGINAS)
    return movs


def obtener_movimientos(desde: datetime.date = None, headless=False) -> dict:
    """Hace todo el flujo (login + bajar movimientos) y devuelve
    {"saldo": ..., "movimientos": [...]}  — el mismo formato que espera
    lib/sync/banco.js de la web (ver finanzas-hogar/README.md). Cada
    movimiento trae id, fecha, descripcion, monto (positivo=ingreso,
    negativo=gasto), moneda, origen, cuotas, comprobante.

    Por default trae solo lo del mes actual (desde=None); pasá una fecha
    para traer desde ahí, o datetime.date.min para todo el historial.
    Pensada para llamarse desde otro programa (ej. un backend web) sin
    tocar la consola."""
    if desde is None:
        desde = inicio_mes_actual()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        ctx = browser.new_context(locale="es-AR")
        hallado = preparar_captura_bc(ctx)  # enganchado ANTES del login
        page = iniciar_sesion(ctx)

        print(">>> Buscando los identificadores de sesión de la API...")
        bc = esperar_bc(page, hallado)

        cuentas = listar_cuentas(page, bc)
        tarjetas = [t for t in listar_tarjetas(page, bc) if t.get("productType") == "TC"]

        # Saldo disponible = suma de las cuentas en pesos (se deja afuera la
        # caja de ahorro en USD para no mezclar monedas en un solo número).
        saldo = sum(c.get("balance", 0) for c in cuentas if c.get("currency") == "ARS")

        todos = []
        for cuenta in cuentas:
            print(f">>> Bajando movimientos de {cuenta.get('shortLabel')}...")
            try:
                todos += movimientos_cuenta(page, bc, cuenta, desde=desde)
            except Exception as e:
                print(f"    Error con esta cuenta, la salto: {e}")

        for tarjeta in tarjetas:
            print(f">>> Bajando consumos de {tarjeta.get('shortLabel')}...")
            try:
                todos += movimientos_tarjeta(page, bc, tarjeta, desde=desde)
            except Exception as e:
                print(f"    Error con esta tarjeta, la salto: {e}")

        browser.close()
    return {"saldo": saldo, "movimientos": todos}


# ----------------------------------------------------------- modo exploración


def explorar():
    """Abre el navegador, loguea solo, y mientras navegués a mano registra
    todas las llamadas XHR/fetch que hace la página (con cuerpo del pedido
    incluido). Es la herramienta de debug: si el banco cambia un endpoint,
    esto ayuda a encontrar el nuevo."""
    OUT = Path("captura_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S"))
    (OUT / "respuestas").mkdir(parents=True)
    llamadas = []
    contador = [0]
    terminar = threading.Event()

    def nombre_archivo(url, n):
        ruta = url.split("?")[0].split("/", 3)[-1]
        return f"{n:03d}_" + re.sub(r"[^a-zA-Z0-9]+", "_", ruta)[:80] + ".json"

    def on_response(resp):
        req = resp.request
        if req.resource_type not in ("xhr", "fetch"):
            return
        entrada = {
            "metodo": req.method,
            "url": resp.url,
            "status": resp.status,
            "tipo": resp.headers.get("content-type", ""),
        }
        cuerpo_crudo = req.post_data
        if cuerpo_crudo:
            try:
                entrada["cuerpo_pedido"] = json.loads(cuerpo_crudo)
            except ValueError:
                entrada["cuerpo_pedido"] = cuerpo_crudo
        if "json" in entrada["tipo"]:
            try:
                datos = resp.json()
                contador[0] += 1
                archivo = nombre_archivo(resp.url, contador[0])
                (OUT / "respuestas" / archivo).write_text(
                    json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                entrada["archivo"] = archivo
            except Exception as e:  # redirecciones, cuerpos vacíos, etc.
                entrada["error_lectura"] = str(e)
        llamadas.append(entrada)
        (OUT / "llamadas.json").write_text(
            json.dumps(llamadas, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"[{resp.status}] {req.method} {resp.url[:130]}")

    def esperar_enter():
        input(
            "\n>>> 1) Revisá que quedaste logueado (completá a mano cualquier paso extra).\n"
            ">>> 2) Navegá a donde quieras inspeccionar.\n"
            ">>> 3) Volvé a esta consola y apretá Enter para guardar todo.\n\n"
        )
        terminar.set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        ctx = browser.new_context(locale="es-AR")
        ctx.on("response", on_response)
        iniciar_sesion(ctx)

        threading.Thread(target=esperar_enter, daemon=True).start()
        while not terminar.is_set():
            if not ctx.pages:
                print("Se cerró el navegador.")
                break
            ctx.pages[-1].wait_for_timeout(500)

        if ctx.pages:
            ultima = ctx.pages[-1]
            ultima.screenshot(path=str(OUT / "pantalla_final.png"), full_page=True)
            (OUT / "pagina_final.html").write_text(ultima.content(), encoding="utf-8")

        browser.close()

    print(f"\nListo: {len(llamadas)} llamadas registradas, {contador[0]} respuestas JSON.")
    print(f"Todo quedó en la carpeta: {OUT.resolve()}")


# ------------------------------------------------------------- servidor web


class ManejadorPedidos(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?")[0] not in ("/", "/movimientos"):
            self.send_response(404)
            self.end_headers()
            return

        clave = os.environ.get("BANK_API_KEY")
        if clave and self.headers.get("Authorization") != f"Bearer {clave}":
            self._json(401, {"error": "No autorizado"})
            return

        try:
            datos = obtener_movimientos()
            self._json(200, datos)
        except Exception as e:
            self._json(500, {"error": str(e)})

    def _json(self, status, datos):
        cuerpo = json.dumps(datos, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def log_message(self, fmt, *args):
        print(">>> " + (fmt % args))


def servir(puerto=8765):
    """Levanta esto como 'tu API del banco' (BANK_API_URL en la web). Cada
    pedido a /movimientos hace el login + la extracción completa en el
    momento (puede tardar), y devuelve exactamente lo que lib/sync/banco.js
    espera. Pensado para correr en TU PC, no en Vercel (necesita un
    navegador real y a veces que completes el token a mano)."""
    clave = os.environ.get("BANK_API_KEY")
    if not clave:
        print(">>> AVISO: no seteaste la variable de entorno BANK_API_KEY.")
        print(">>> El endpoint queda SIN CLAVE: cualquiera que llegue a este puerto puede pedir tus movimientos.")
    print(f">>> Escuchando en http://localhost:{puerto}/movimientos")
    HTTPServer(("0.0.0.0", puerto), ManejadorPedidos).serve_forever()


# --------------------------------------------------------------------------- CLI


def main():
    parser = argparse.ArgumentParser(description="Homebanking Banco Santa Fe")
    parser.add_argument(
        "comando",
        nargs="?",
        default="extraer",
        choices=["guardar-credenciales", "extraer", "explorar", "servir"],
    )
    parser.add_argument("--puerto", type=int, default=8765, help="solo para 'servir'")
    args = parser.parse_args()

    if args.comando == "guardar-credenciales":
        guardar_credenciales()
    elif args.comando == "explorar":
        explorar()
    elif args.comando == "servir":
        servir(args.puerto)
    else:
        datos = obtener_movimientos()
        out = Path("movimientos_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".json")
        out.write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nListo: {len(datos['movimientos'])} movimientos guardados en {out.resolve()}")
        print(f"Saldo: {datos['saldo']}")


if __name__ == "__main__":
    main()
