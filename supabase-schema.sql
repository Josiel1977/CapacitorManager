/*
-- SQL para criação das tabelas no Supabase

-- 1. Clientes
CREATE TABLE clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cnpj_cpf TEXT,
    contato_responsavel TEXT,
    telefone TEXT,
    email TEXT,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Bancos de Capacitores
CREATE TABLE bancos_capacitores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    nome_banco TEXT NOT NULL,
    localizacao TEXT,
    tensao_nominal NUMERIC,
    potencia_total_kvar NUMERIC,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Capacitores
CREATE TABLE capacitores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banco_id UUID REFERENCES bancos_capacitores(id) ON DELETE CASCADE,
    codigo_identificacao TEXT NOT NULL,
    potencia_kvar NUMERIC NOT NULL,
    capacitancia_nominal_uf NUMERIC NOT NULL,
    tensao_nominal_v NUMERIC NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Medições
CREATE TABLE medicoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capacitor_id UUID REFERENCES capacitores(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    banco_id UUID REFERENCES bancos_capacitores(id) ON DELETE CASCADE,
    tipo_teste TEXT CHECK (tipo_teste IN ('corrente', 'capacitancia')),
    tensao_medida_v NUMERIC,
    corrente_medida_a NUMERIC,
    corrente_teorica_a NUMERIC,
    capacitancia_medida_uf NUMERIC,
    desvio_percentual NUMERIC,
    status_validacao TEXT CHECK (status_validacao IN ('aprovado', 'atencao', 'reprovado')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Configurações Globais
CREATE TABLE configuracoes (
    id TEXT PRIMARY KEY DEFAULT 'global',
    tolerancia_min_aprovado NUMERIC DEFAULT -5,
    tolerancia_max_aprovado NUMERIC DEFAULT 10,
    tolerancia_min_atencao NUMERIC DEFAULT -10,
    tolerancia_max_atencao NUMERIC DEFAULT 15,
    norma_referencia TEXT DEFAULT 'IEC 60831-1/2',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Inserir configuração inicial
INSERT INTO configuracoes (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
*/
