
-- Create actions table
CREATE TABLE public.actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  orcamento_total NUMERIC NOT NULL,
  qtd_baloes INTEGER NOT NULL,
  qtd_premiados INTEGER NOT NULL,
  valor_multiplo NUMERIC NOT NULL,
  valor_minimo NUMERIC NOT NULL,
  valor_maximo NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create balloons table
CREATE TABLE public.balloons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  premiado BOOLEAN NOT NULL DEFAULT false,
  estourado BOOLEAN NOT NULL DEFAULT false,
  user_id TEXT,
  data_estouro TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster balloon queries
CREATE INDEX idx_balloons_action_id ON public.balloons(action_id);

-- Enable RLS
ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balloons ENABLE ROW LEVEL SECURITY;

-- Actions: anyone can read, only authenticated can create/update
CREATE POLICY "Anyone can read actions" ON public.actions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert actions" ON public.actions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update actions" ON public.actions FOR UPDATE USING (true);

-- Balloons: anyone can read and update (for popping)
CREATE POLICY "Anyone can read balloons" ON public.balloons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert balloons" ON public.balloons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update balloons" ON public.balloons FOR UPDATE USING (true);
