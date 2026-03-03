import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Lock, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { token } = await login(username, password);
            localStorage.setItem("adminToken", token);
            localStorage.setItem("adminUser", username);
            toast.success("Login efetuado com sucesso!");
            navigate("/admin");
        } catch (err: any) {
            toast.error(err.message || "Credenciais inválidas");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Decorative background balloons */}
            <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-balloon-blue/20 blur-3xl" />
            <div className="absolute bottom-20 right-10 w-48 h-48 rounded-full bg-balloon-red/20 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />

            <Card className="w-full max-w-sm relative z-10 border-2 shadow-2xl">
                <CardHeader className="text-center pb-6">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <CardTitle className="font-display text-2xl font-bold">Acesso Restrito</CardTitle>
                    <CardDescription>Insira suas credenciais de administrador para acessar o painel</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Usuário</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="username"
                                    placeholder="Seu usuário"
                                    className="pl-9"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className="pl-9"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" className="w-full mt-6" disabled={loading || !username || !password}>
                            {loading ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...</>
                            ) : (
                                "Entrar no Painel"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
