# Evidencias de qualidade do modulo Pedido

Data da evidencia: 2026-07-11.

## Fluxos cobertos

O modulo Pedido cobre o ciclo principal da distribuidora:

- criacao de pedido em rascunho para cliente existente;
- inclusao e remocao de itens apenas enquanto o pedido esta em rascunho;
- alteracao da quantidade de item em rascunho com recalculo do total;
- validacao de produto existente, disponivel e com preco coerente;
- definicao ou troca da forma de pagamento apenas enquanto o pedido esta em
  rascunho;
- bloqueio de forma de pagamento inexistente ou inativa;
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
npm test
```

Resultado em 2026-07-11:

- 49 suites passaram;
- 317 testes passaram;
- cobertura global: 85.35% statements, 77.43% branches, 72.38% funcs e
  85.58% lines;
- cobertura dos novos use cases de pedido:
  `set-order-payment-type.use-case.ts` e
  `update-order-item-quantity.use-case.ts` com 100% statements, branches,
  funcs e lines.

Os testes incluem unitarios, integracao e property-based tests para totalizacao,
maquina de estados, confirmacao, cancelamento, round-trip de estoque, troca de
forma de pagamento e alteracao de quantidade de item.

## Evidencia de build

Comando executado:

```bash
npm run build
```

Resultado em 2026-07-11: build concluido com sucesso.

## Evidencia de integracao em container

Comando executado:

```bash
docker compose up -d --build
```

Smoke HTTP executado contra `http://localhost:3000` no container:

- criar cliente;
- criar forma de pagamento;
- criar produto;
- criar pedido;
- definir forma de pagamento do pedido;
- adicionar item ao pedido;
- atualizar quantidade do item de 2 para 4;
- consultar o pedido e validar quantidade persistida e total recalculado.

Resultado em 2026-07-11: smoke concluido com sucesso, retornando pedido com
quantidade `4` e total `50`.
