
// ===========================
// BDT – Busca do Tempo
// script.js — Lógica do site
// ===========================

// -------------------------------------------------------
// URLS DAS APIS (endereços de onde buscamos os dados)
// -------------------------------------------------------
// API de geocoding: converte "São Paulo" → latitude e longitude
const URL_GEO = "https://geocoding-api.open-meteo.com/v1/search";

// API de clima: recebe latitude/longitude e retorna temperatura, chuva etc.
const URL_CLIMA = "https://api.open-meteo.com/v1/forecast";


// -------------------------------------------------------
// TABELA DE CLIMAS (código WMO → emoji + descrição)
// -------------------------------------------------------
// A API retorna um número (ex: 61 = chuva fraca).
// Essa tabela traduz esse número para algo legível.
const CLIMAS = {
  0:  { desc: "Céu limpo",             icone: "☀️" },
  1:  { desc: "Predominantemente limpo",icone: "🌤️" },
  2:  { desc: "Parcialmente nublado",   icone: "⛅" },
  3:  { desc: "Nublado",               icone: "☁️" },
  45: { desc: "Neblina",               icone: "🌫️" },
  51: { desc: "Garoa leve",            icone: "🌦️" },
  61: { desc: "Chuva fraca",           icone: "🌧️" },
  63: { desc: "Chuva moderada",        icone: "🌧️" },
  65: { desc: "Chuva forte",           icone: "🌧️" },
  80: { desc: "Pancadas de chuva",     icone: "🌦️" },
  95: { desc: "Trovoada",              icone: "⛈️" },
  99: { desc: "Tempestade com granizo",icone: "🌩️" },
};


// -------------------------------------------------------
// FUNÇÕES DE APOIO (pequenas funções que ajudam outras)
// -------------------------------------------------------

// Busca o clima na tabela pelo código. Se não achar, retorna padrão.
function getClima(codigo) {
  return CLIMAS[codigo] || { desc: "Clima desconhecido", icone: "🌡️" };
}

// Retorna a data de hoje formatada em português
// Ex: "Segunda-feira, 9 de junho"
function dataDeHoje() {
  const hoje = new Date();
  const str = hoje.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return str.charAt(0).toUpperCase() + str.slice(1); // capitaliza a primeira letra
}

// Recebe uma data no formato "2025-06-10" e retorna o dia da semana abreviado
// Ex: "2025-06-10" → "Ter"
function nomeDoDia(dataStr) {
  const [ano, mes, dia] = dataStr.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia); // mês começa em 0 no JS
  const dias = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return dias[data.getDay()];
}

// Verifica se um código de clima indica chuva
// Retorna true (vai chover) ou false (não vai chover)
function vaiChover(codigo) {
  const codigosDeChuva = [51, 53, 55, 61, 63, 65, 71, 73, 75, 80, 81, 82, 95, 96, 99];
  return codigosDeChuva.includes(codigo);
}


// -------------------------------------------------------
// HISTÓRICO DE BUSCAS (salvo no localStorage do navegador)
// -------------------------------------------------------
// O localStorage é como um "caderninho" do navegador.
// Os dados ficam salvos mesmo depois de fechar a aba.

// Lê o histórico salvo (retorna array de cidades)
function lerHistorico() {
  return JSON.parse(localStorage.getItem("bdt_historico") || "[]");
}

// Salva uma cidade nova no histórico (máximo 5, sem repetir)
function salvarNaHistorico(cidade) {
  // Remove a cidade se já existir (para não repetir)
  let hist = lerHistorico().filter(c => c.toLowerCase() !== cidade.toLowerCase());
  hist.unshift(cidade); // adiciona no começo da lista
  if (hist.length > 5) hist = hist.slice(0, 5); // limita a 5
  localStorage.setItem("bdt_historico", JSON.stringify(hist));
  mostrarHistorico(); // atualiza a tela
}

// Desenha o histórico na tela
function mostrarHistorico() {
  const hist = lerHistorico();
  const area  = document.getElementById("historico-area");
  const lista = document.getElementById("historico-lista");

  // Se não tiver nada no histórico, esconde a seção
  if (hist.length === 0) { area.classList.add("oculto"); return; }

  area.classList.remove("oculto");
  lista.innerHTML = ""; // limpa antes de redesenhar

  // Para cada cidade salva, cria um item clicável
  hist.forEach(cidade => {
    const item = document.createElement("div");
    item.classList.add("historico-item");
    item.innerHTML = `🕐 ${cidade}`;

    // Ao clicar, preenche o campo e faz a busca automaticamente
    item.addEventListener("click", () => {
      document.getElementById("input-cidade").value = cidade;
      buscarTempo();
    });

    lista.appendChild(item); // adiciona na tela
  });
}

// Remove todo o histórico do localStorage e atualiza a tela
function limparHistorico() {
  localStorage.removeItem("bdt_historico");
  mostrarHistorico();
}


// -------------------------------------------------------
// CONTROLE DE TELAS (mostrar/esconder cada seção)
// -------------------------------------------------------

// Mostra o spinner de carregamento
function mostrarLoading() {
  document.getElementById("tela-loading").classList.remove("oculto");
}

// Esconde o spinner de carregamento
function esconderLoading() {
  document.getElementById("tela-loading").classList.add("oculto");
}

// Vai para a tela de resultado (esconde busca, mostra resultado)
function irParaResultado() {
  document.getElementById("tela-busca").classList.remove("ativa");
  document.getElementById("tela-busca").classList.add("oculto");
  document.getElementById("tela-resultado").classList.remove("oculto");
  document.getElementById("tela-resultado").classList.add("ativa");
}

// Volta para a tela de busca (esconde resultado, mostra busca)
function voltarBusca() {
  document.getElementById("tela-resultado").classList.add("oculto");
  document.getElementById("tela-resultado").classList.remove("ativa");
  document.getElementById("tela-busca").classList.remove("oculto");
  document.getElementById("tela-busca").classList.add("ativa");
  exibirErro(""); // limpa qualquer mensagem de erro
}

// Mostra ou esconde a mensagem de erro
function exibirErro(mensagem) {
  const el = document.getElementById("msg-erro");
  if (!mensagem) { el.classList.add("oculto"); return; }
  el.textContent = mensagem;
  el.classList.remove("oculto");
}


// -------------------------------------------------------
// FUNCIONALIDADE 1: BUSCAR POR NOME DE CIDADE
// -------------------------------------------------------
// Essa é a função principal. Quando o usuário clica em "Buscar"
// ou aperta Enter, ela é chamada.

async function buscarTempo() {
  // Pega o que o usuário digitou e remove espaços extras
  const cidade = document.getElementById("input-cidade").value.trim();

  if (!cidade) { exibirErro("Por favor, digite o nome de uma cidade."); return; }

  exibirErro("");    // limpa erros anteriores
  mostrarLoading();  // mostra o spinner

  try {
    // PASSO 1: Converte o nome da cidade em coordenadas (lat/lon)
    // encodeURIComponent garante que acentos e espaços não quebrem a URL
    const resGeo  = await fetch(`${URL_GEO}?name=${encodeURIComponent(cidade)}&count=1&language=pt&format=json`);
    const dadosGeo = await resGeo.json();

    // Se a API não encontrou a cidade, mostra erro
    if (!dadosGeo.results || dadosGeo.results.length === 0) {
      esconderLoading();
      exibirErro(`Cidade "${cidade}" não encontrada. Verifique o nome.`);
      return;
    }

    const local = dadosGeo.results[0]; // pega o primeiro resultado
    // Monta um nome bonito: "São Paulo, SP – Brazil"
    const nomeFormatado = `${local.name}${local.admin1 ? ", " + local.admin1 : ""} – ${local.country}`;

    // PASSO 2: Busca o clima usando as coordenadas encontradas
    await buscarClimaPorCoordenadas(local.latitude, local.longitude, nomeFormatado);

    salvarNaHistorico(local.name); // guarda no histórico

  } catch (erro) {
    esconderLoading();
    exibirErro("Erro ao conectar. Verifique sua internet.");
    console.error(erro); // mostra o erro técnico no console do navegador (F12)
  }
}


// -------------------------------------------------------
// FUNCIONALIDADE 1B: USAR LOCALIZAÇÃO DO DISPOSITIVO (GPS)
// -------------------------------------------------------
// navigator.geolocation é uma API nativa do navegador
// que acessa o GPS do celular ou a localização do IP no PC.

function usarLocalizacao() {
  if (!navigator.geolocation) {
    exibirErro("Seu navegador não suporta geolocalização.");
    return;
  }

  exibirErro("");
  mostrarLoading();

  // Pede a localização. O navegador vai perguntar ao usuário se ele aceita.
  navigator.geolocation.getCurrentPosition(
    // Callback de SUCESSO: recebe as coordenadas
    async (posicao) => {
      const { latitude, longitude } = posicao.coords;

      try {
        // Usa o Nominatim (OpenStreetMap) para descobrir o nome da cidade
        // a partir das coordenadas (geocodificação reversa)
        const res    = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=pt`);
        const dados  = await res.json();
        const end    = dados.address;

        // Tenta pegar o nome da cidade (pode ser city, town ou village)
        const nomeFormatado = [
          end.city || end.town || end.village || "Sua localização",
          end.state,
          end.country
        ].filter(Boolean).join(", "); // junta só os que existirem

        await buscarClimaPorCoordenadas(latitude, longitude, nomeFormatado);

        const cidadePrincipal = end.city || end.town || end.village || "Minha localização";
        salvarNaHistorico(cidadePrincipal);

      } catch (erro) {
        esconderLoading();
        exibirErro("Não consegui identificar sua cidade. Tente digitar o nome.");
      }
    },

    // Callback de ERRO: usuário negou a permissão ou deu outro erro
    () => {
      esconderLoading();
      exibirErro("Permissão negada. Digite o nome da cidade.");
    }
  );
}


// -------------------------------------------------------
// BUSCAR CLIMA POR COORDENADAS (latitude e longitude)
// -------------------------------------------------------
// Aqui fazemos a chamada principal para a API open-meteo.com

async function buscarClimaPorCoordenadas(lat, lon, nomeCidade) {
  // Montamos os parâmetros da requisição
  // URLSearchParams monta a query string automaticamente
  const params = new URLSearchParams({
    latitude:     lat,
    longitude:    lon,
    // current = dados do momento atual
    current:      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation",
    // daily = dados por dia (para a previsão)
    daily:        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
    timezone:     "auto",        // detecta o fuso horário automaticamente
    forecast_days: 4             // hoje + próximos 3 dias
  });

  const res   = await fetch(`${URL_CLIMA}?${params}`);
  const dados = await res.json();

  esconderLoading();
  preencherTela(nomeCidade, dados); // exibe os dados
  irParaResultado();                // muda para a tela de resultado
}


// -------------------------------------------------------
// FUNCIONALIDADE 2 e 3: PREENCHER A TELA COM OS DADOS
// -------------------------------------------------------
// Pega os dados que vieram da API e coloca nos elementos HTML

function preencherTela(nomeCidade, dados) {
  const atual  = dados.current; // dados de agora
  const diario = dados.daily;   // dados por dia

  // -- Nome da cidade e data --
  document.getElementById("res-cidade").textContent = nomeCidade;
  document.getElementById("res-data").textContent   = dataDeHoje();

  // -- Temperatura atual (arredonda para número inteiro) --
  document.getElementById("res-temp").textContent = Math.round(atual.temperature_2m);

  // -- Ícone e descrição do clima --
  const clima = getClima(atual.weather_code);
  document.getElementById("res-icone").textContent      = clima.icone;
  document.getElementById("res-descricao").textContent  = clima.desc;

  // -- Detalhes: sensação, umidade, vento, chuva --
  document.getElementById("res-sensacao").textContent = `${Math.round(atual.apparent_temperature)}°C`;
  document.getElementById("res-umidade").textContent  = `${atual.relative_humidity_2m}%`;
  document.getElementById("res-vento").textContent    = `${Math.round(atual.wind_speed_10m)} km/h`;
  document.getElementById("res-chuva").textContent    = `${atual.precipitation ?? 0} mm`;

  // -- FUNCIONALIDADE 3: Alerta de chuva --
  // Verifica o código do clima de HOJE (índice 0 do array diário)
  const alertaEl = document.getElementById("alerta-chuva");
  const textoEl  = document.getElementById("texto-alerta");
  const mmHoje   = diario.precipitation_sum[0] || 0;

  if (vaiChover(diario.weather_code[0])) {
    alertaEl.classList.remove("oculto"); // mostra o alerta
    textoEl.textContent = mmHoje > 0
      ? `Chuva prevista hoje! Acumulado estimado: ${mmHoje.toFixed(1)} mm`
      : "Possibilidade de chuva hoje. Leve um guarda-chuva! ☂️";
  } else {
    alertaEl.classList.add("oculto"); // esconde se não for chover
  }

  // -- Previsão dos próximos 3 dias --
  // O índice 0 é hoje, então começamos do 1
  const listaEl = document.getElementById("previsao-lista");
  listaEl.innerHTML = ""; // limpa antes de redesenhar

  for (let i = 1; i <= 3; i++) {
    const climaDia = getClima(diario.weather_code[i]);
    const max      = Math.round(diario.temperature_2m_max[i]);
    const min      = Math.round(diario.temperature_2m_min[i]);
    const chuvaInfo = vaiChover(diario.weather_code[i])
      ? `🌧 ${(diario.precipitation_sum[i] || 0).toFixed(1)} mm`
      : "";

    // Cria o card do dia com innerHTML (monta o HTML como string)
    const card = document.createElement("div");
    card.classList.add("previsao-item");
    card.innerHTML = `
      <div class="prev-dia">${nomeDoDia(diario.time[i])}</div>
      <div class="prev-icon">${climaDia.icone}</div>
      <div class="prev-max">${max}°C</div>
      <div class="prev-min">${min}°C</div>
      <div class="prev-min" style="font-size:11px;color:#4fc3f7;margin-top:4px">${chuvaInfo}</div>
    `;
    listaEl.appendChild(card);
  }
}


// -------------------------------------------------------
// EVENTOS DE INTERAÇÃO
// -------------------------------------------------------

// Permite buscar apertando ENTER no campo de texto
document.getElementById("input-cidade").addEventListener("keydown", function(e) {
  if (e.key === "Enter") buscarTempo();
});

// Quando a página carrega, mostra o histórico de buscas salvo
window.addEventListener("DOMContentLoaded", () => {
  mostrarHistorico();
});