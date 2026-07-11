# Evidencias de qualidade do modulo Pedido

Data da evidencia: 2026-07-11.

## Fluxos cobertos

O modulo Pedido cobre o ciclo principal da distribuidora:

- criacao de pedido em rascunho para cliente existente;
- inclusao e remocao de itens apenas enquanto o pedido esta em rascunho;
- validacao de produto existente, disponivel e com preco coerente;
- confirmacao com tipo de pagamento valido e saldo suficiente em estoque;
- baixa de estoque dentro da transacao de confirmacao;
- cancelamento com reversao de estoque para pedidos confirmados ou em separacao;
- transicoes de status controladas por maquina de estados.

## Rastreabilidade operacional

Os fluxos mutaveis aceitam `x-correlation-id` e geram um identificador quando o
cabecalho nao e enviado. Esse valor e propagado para os use cases e registrado em
logs estruturados, permitindo rastrear a operacao entre controller, regra de
aplicacao e persistencia.

A reversao de estoque no cancelamento registra o motivo
`Order <id> cancellation`, alinhando o movimento de entrada ao pedido que causou
a compensacao.

## Evidencias de teste

Comando executado:

```bash
npm run test:coverage:order
```

Resultado em 2026-07-11:

- 14 suites passaram;
- 79 testes passaram;
- cobertura do recorte de pedido: 86.61% statements, 80.59% branches, 79.34%
  funcs e 87.97% lines.

Os testes incluem unitarios, integracao e property-based tests para totalizacao,
maquina de estados, confirmacao, cancelamento e round-trip de estoque.

## Evidencia de build

Comando executado:

```bash
npm run build
```

Resultado em 2026-07-11: build concluido com sucesso.
