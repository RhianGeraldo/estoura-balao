
CREATE TABLE public.unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read unidades" ON public.unidades FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unidades" ON public.unidades FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unidades" ON public.unidades FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete unidades" ON public.unidades FOR DELETE USING (true);
