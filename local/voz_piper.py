"""Serviço de voz do Jarvis local.

Carrega uma voz do Piper uma única vez e transforma texto em fala (WAV) por HTTP.
Quem inicia este serviço é o server.mjs, com o Python instalado em JARVIS_LOCAL
(veja o .env). Só aceita conexões do próprio computador (127.0.0.1).

    GET  /saude  -> "ok" quando a voz está carregada
    POST /falar  -> corpo: o texto em UTF-8 (até 2.000 caracteres); resposta: audio/wav

Se a variável JARVIS_VOZ_CHAVE existir, /falar exige o cabeçalho X-Chave com o mesmo valor.
Assim páginas abertas no navegador não conseguem usar a voz: o cabeçalho próprio obriga o
navegador a pedir permissão antes, e este serviço nunca dá essa permissão.
"""
import argparse
import hmac
import io
import os
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from piper import PiperVoice, SynthesisConfig

parser = argparse.ArgumentParser(description="Serviço de voz do Jarvis (Piper)")
parser.add_argument("--voz", required=True, help="Caminho do arquivo .onnx da voz")
parser.add_argument("--porta", type=int, default=5301)
parser.add_argument("--velocidade", type=float, default=1.0, help="Menor que 1 fala mais rápido")
args = parser.parse_args()

voz = PiperVoice.load(args.voz)
config = SynthesisConfig(length_scale=args.velocidade)
trava = threading.Lock()  # o modelo atende um pedido por vez
INICIO, ENTRE_FRASES, FIM = 0.25, 0.2, 0.12  # silêncios, em segundos
chave = os.environ.get("JARVIS_VOZ_CHAVE", "")


class Pedido(BaseHTTPRequestHandler):
    def _responder(self, status, corpo, tipo="text/plain; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if self.path == "/saude":
            self._responder(200, b"ok")
        else:
            self._responder(404, b"nao encontrado")

    def do_POST(self):
        if self.path != "/falar":
            return self._responder(404, b"nao encontrado")
        recebida = self.headers.get("X-Chave", "").encode("utf-8", "replace")
        if chave and not hmac.compare_digest(recebida, chave.encode("utf-8")):
            return self._responder(403, b"sem permissao")
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0 or tamanho > 8000:
            return self._responder(413, b"texto vazio ou grande demais")
        texto = self.rfile.read(tamanho).decode("utf-8", "replace").strip()[:2000]
        if not texto:
            return self._responder(400, b"texto vazio")
        with trava:
            pedacos = list(voz.synthesize(texto, syn_config=config))
        taxa = voz.config.sample_rate

        def silencio(segundos):
            return b"\x00\x00" * int(taxa * segundos)

        saida = io.BytesIO()
        with wave.open(saida, "wb") as arquivo:
            arquivo.setnchannels(1)
            arquivo.setsampwidth(2)
            arquivo.setframerate(taxa)
            # Fones Bluetooth e algumas placas de som "acordam" só quando o áudio começa
            # e comem o primeiro pedaço da frase: um respiro no início evita isso.
            arquivo.writeframes(silencio(INICIO))
            for i, pedaco in enumerate(pedacos):
                if i:
                    arquivo.writeframes(silencio(ENTRE_FRASES))
                arquivo.writeframes(pedaco.audio_int16_bytes)
            arquivo.writeframes(silencio(FIM))
        self._responder(200, saida.getvalue(), "audio/wav")

    def log_message(self, *_):
        pass  # sem log a cada frase


if __name__ == "__main__":
    print(f"voz pronta na porta {args.porta}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.porta), Pedido).serve_forever()
