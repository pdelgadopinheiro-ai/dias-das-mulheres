// =========================
// ELEMENTOS DA PÁGINA
// =========================

const fotoInput = document.getElementById("fotoInput");
const buttonAddFoto = document.getElementById("button-addFoto");
const buttonPlayMusica = document.getElementById("button-playMusica");
const carousel = document.getElementById("carousel");
const prevButton = document.getElementById("prev");
const nextButton = document.getElementById("next");

let imagens = [];
let indexAtual = 0;
const STORAGE_KEY_IMAGENS = "diaMulheresImagens";
const STORAGE_KEY_INDEX = "diaMulheresIndexAtual";
const SUPABASE_URL = "COLOQUE_AQUI_SUA_SUPABASE_URL";
const SUPABASE_ANON_KEY = "COLOQUE_AQUI_SUA_SUPABASE_ANON_KEY";
const SUPABASE_BUCKET = "fotos";
const SUPABASE_TABLE = "fotos_carrossel";
let supabaseClient = null;

// =========================
// PERSISTÊNCIA LOCAL
// =========================

function salvarEstadoLocal() {
    try {
        localStorage.setItem(STORAGE_KEY_IMAGENS, JSON.stringify(imagens));
        localStorage.setItem(STORAGE_KEY_INDEX, String(indexAtual));
    } catch (erro) {
        console.error("Não foi possível salvar as fotos no navegador.", erro);
    }
}

function carregarEstadoLocal() {
    try {
        const imagensSalvas = localStorage.getItem(STORAGE_KEY_IMAGENS);
        const indexSalvo = localStorage.getItem(STORAGE_KEY_INDEX);

        if (imagensSalvas) {
            const lista = JSON.parse(imagensSalvas);
            if (Array.isArray(lista)) {
                imagens = lista;
            }
        }

        if (indexSalvo !== null) {
            const valor = Number(indexSalvo);
            if (!Number.isNaN(valor) && valor >= 0) {
                indexAtual = valor;
            }
        }

        if (indexAtual >= imagens.length) {
            indexAtual = 0;
        }
    } catch (erro) {
        console.error("Não foi possível carregar as fotos salvas.", erro);
        imagens = [];
        indexAtual = 0;
    }
}

function supabaseConfigurado() {
    return (
        SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes("COLOQUE_AQUI") &&
        !SUPABASE_ANON_KEY.includes("COLOQUE_AQUI")
    );
}

function obterClienteSupabase() {
    if (supabaseClient) return supabaseClient;
    if (!supabaseConfigurado()) return null;
    if (!window.supabase || !window.supabase.createClient) return null;

    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabaseClient;
}

function gerarNomeArquivoSeguro(nomeOriginal) {
    const nomeLimpo = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, "-");
    const idUnico =
        typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    return `${idUnico}-${nomeLimpo}`;
}

function definirUploadEmAndamento(ativo) {
    if (!buttonAddFoto || !fotoInput) return;
    buttonAddFoto.disabled = ativo;
    fotoInput.disabled = ativo;
    buttonAddFoto.textContent = ativo ? "Enviando fotos..." : "Adicionar Fotos";
}

async function carregarImagensNuvem() {
    const client = obterClienteSupabase();
    if (!client) return false;

    const { data, error } = await client
        .from(SUPABASE_TABLE)
        .select("id, image_url")
        .order("id", { ascending: true });

    if (error) throw error;

    imagens = Array.isArray(data) ? data.map((item) => item.image_url).filter(Boolean) : [];
    if (indexAtual >= imagens.length) {
        indexAtual = 0;
    }

    salvarEstadoLocal();
    return true;
}

async function enviarFotoParaNuvem(arquivo) {
    const client = obterClienteSupabase();
    if (!client) throw new Error("Supabase não configurado.");

    const nomeArquivo = gerarNomeArquivoSeguro(arquivo.name);
    const caminhoArquivo = `carrossel/${nomeArquivo}`;

    const { error: uploadError } = await client.storage
        .from(SUPABASE_BUCKET)
        .upload(caminhoArquivo, arquivo, { upsert: false });

    if (uploadError) throw uploadError;

    const { data: publicData } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(caminhoArquivo);
    const imageUrl = publicData && publicData.publicUrl ? publicData.publicUrl : "";

    if (!imageUrl) {
        throw new Error("Não foi possível obter a URL pública da imagem.");
    }

    const { error: insertError } = await client.from(SUPABASE_TABLE).insert({ image_url: imageUrl });

    if (insertError) throw insertError;
}

// =========================
// BOTÃO ADICIONAR FOTO
// =========================

if (buttonAddFoto && fotoInput) {
    buttonAddFoto.addEventListener("click", function () {
        fotoInput.click();
    });
}

// quando o usuário seleciona imagens
if (fotoInput) {
    fotoInput.addEventListener("change", async function () {
        const arquivos = this.files;

        if (!arquivos || arquivos.length === 0) return;

        if (supabaseConfigurado()) {
            definirUploadEmAndamento(true);
            try {
                for (let i = 0; i < arquivos.length; i++) {
                    await enviarFotoParaNuvem(arquivos[i]);
                }
                await carregarImagensNuvem();
                atualizarCarrossel();
            } catch (erro) {
                console.error("Falha ao enviar fotos para a nuvem.", erro);
                alert("Não foi possível enviar as fotos para a nuvem.");
            } finally {
                definirUploadEmAndamento(false);
                fotoInput.value = "";
            }
            return;
        }

        for (let i = 0; i < arquivos.length; i++) {
            const reader = new FileReader();

            reader.onload = function (evento) {
                imagens.push(evento.target.result);
                salvarEstadoLocal();
                atualizarCarrossel();
            };

            reader.readAsDataURL(arquivos[i]);
        }

        fotoInput.value = "";
    });
}

// =========================
// RENDERIZAÇÃO DO CARROSSEL
// =========================

function atualizarCarrossel() {
    if (!carousel) return;

    carousel.innerHTML = "";

    if (imagens.length === 0) return;

    const img = document.createElement("img");
    img.src = imagens[indexAtual];
    img.alt = "Foto carregada";

    carousel.appendChild(img);
    salvarEstadoLocal();
}

// =========================
// BOTÃO PRÓXIMA FOTO
// =========================

if (nextButton) {
    nextButton.addEventListener("click", function () {
        if (imagens.length === 0) return;

        indexAtual++;

        if (indexAtual >= imagens.length) {
            indexAtual = 0;
        }

        atualizarCarrossel();
    });
}

// =========================
// BOTÃO FOTO ANTERIOR
// =========================

if (prevButton) {
    prevButton.addEventListener("click", function () {
        if (imagens.length === 0) return;

        indexAtual--;

        if (indexAtual < 0) {
            indexAtual = imagens.length - 1;
        }

        atualizarCarrossel();
    });
}

// =========================
// ADICIONAR SPOTIFY
// =========================

// Troque este link pelo da música/playlist/álbum que você quiser tocar.
const SPOTIFY_LINK_FIXO = "https://open.spotify.com/intl-pt/track/4f4WCZ4eOxQW6Jn4nu3sqZ?si=54fc52fcf80d4810";

function montarEmbedSpotify(link) {
    let embed = "";
    let tipoConteudo = "";

    try {
        const url = new URL(link);
        const partes = url.pathname.split("/").filter(Boolean);
        const tiposValidos = ["track", "album", "playlist", "episode", "show", "artist"];
        const inicioTipo = partes[0] && partes[0].startsWith("intl-") ? 1 : 0;
        const tipo = partes[inicioTipo];
        const id = partes[inicioTipo + 1];

        if (url.hostname.includes("spotify.com") && tiposValidos.includes(tipo) && id) {
            embed = `https://open.spotify.com/embed/${tipo}/${id}`;
            tipoConteudo = tipo;
        }
    } catch (e) {
        const partesUri = link.split(":");
        if (partesUri.length === 3 && partesUri[0] === "spotify") {
            const tipo = partesUri[1];
            const id = partesUri[2];
            const tiposValidos = ["track", "album", "playlist", "episode", "show", "artist"];

            if (tiposValidos.includes(tipo) && id) {
                embed = `https://open.spotify.com/embed/${tipo}/${id}`;
                tipoConteudo = tipo;
            }
        }
    }

    if (!embed) return null;
    return { embed, tipoConteudo };
}

function adicionarSpotifyAutomatico(autoplay) {
    const player = document.getElementById("spotifyPlayer");
    if (!player) return;

    const dadosSpotify = montarEmbedSpotify(SPOTIFY_LINK_FIXO);

    if (!dadosSpotify) {
        player.innerHTML = "<p>Link fixo do Spotify inválido.</p>";
        return;
    }

    const { embed, tipoConteudo } = dadosSpotify;
    const altura = tipoConteudo === "track" || tipoConteudo === "episode" ? 152 : 352;
    const srcComAutoplay = autoplay ? `${embed}?autoplay=1` : embed;

    const iframe = document.createElement("iframe");
    iframe.src = srcComAutoplay;
    iframe.width = "100%";
    iframe.height = String(altura);
    iframe.frameBorder = "0";
    iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen";
    iframe.style.width = "100%";
    iframe.style.height = `${altura}px`;

    player.innerHTML = "";
    player.appendChild(iframe);
}

document.addEventListener("DOMContentLoaded", async function () {
    carregarEstadoLocal();
    atualizarCarrossel();

    if (supabaseConfigurado()) {
        try {
            const carregouNuvem = await carregarImagensNuvem();
            if (carregouNuvem) {
                atualizarCarrossel();
            }
        } catch (erro) {
            console.error("Falha ao carregar fotos da nuvem.", erro);
        }
    } else {
        console.warn("Supabase não configurado. Usando apenas armazenamento local.");
    }

    adicionarSpotifyAutomatico(false);
    if (buttonPlayMusica) {
        buttonPlayMusica.addEventListener("click", function () {
            adicionarSpotifyAutomatico(true);
        });
    }
});
