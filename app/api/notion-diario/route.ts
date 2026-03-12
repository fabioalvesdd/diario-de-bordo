import { NextRequest, NextResponse } from "next/server";
import { notion, NOTION_DATABASE_ID } from "@/lib/notion";

function required(value: string, message: string) {
  if (!value?.trim()) throw new Error(message);
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NOTION_TOKEN || !NOTION_DATABASE_ID) {
      return NextResponse.json(
        { ok: false, error: "Variáveis do Notion não configuradas." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const {
      data,
      hora,
      texto,
      responsavel,
      colaboradoresPresentes = [],
      faturamentoDelivery = 0,
      faturamentoSalao = 0,
      faturamentoTotal = 0,
      createdAt,
    } = body;

    required(data, "Data é obrigatória.");
    required(hora, "Hora é obrigatória.");
    required(texto, "Relato do dia é obrigatório.");
    required(responsavel, "Responsável é obrigatório.");

    const response = await notion.pages.create({
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        "Diário de Bordo": {
          title: [
            { text: { content: `${data} • ${responsavel}` } }
          ]
        },
        "Data": { date: { start: data } },
        "Hora": { rich_text: [{ text: { content: hora } }] },
        "Responsável": { select: { name: responsavel } },
        "Colaboradores presentes": {
          multi_select: (Array.isArray(colaboradoresPresentes) ? colaboradoresPresentes : []).map((nome) => ({ name: String(nome) }))
        },
        "Relato do dia": { rich_text: [{ text: { content: String(texto).slice(0, 1900) } }] },
        "Faturamento Delivery": { number: Number(faturamentoDelivery || 0) },
        "Faturamento Salão": { number: Number(faturamentoSalao || 0) },
        "Faturamento Total": { number: Number(faturamentoTotal || 0) },
        "Criado em": { date: { start: createdAt || new Date().toISOString() } }
      }
    });

    return NextResponse.json({ ok: true, notionPageId: response.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao enviar para o Notion.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
