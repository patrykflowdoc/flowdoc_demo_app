import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getCompanySettings, updateCompanySettings, uploadAdminImage } from "@/api/client";
import { toast } from "@/components/ui/sonner";
import { Image, Loader2, Upload, X } from "lucide-react";

const SettingsCompanyView = () => {
  const [_settingsId, setSettingsId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [nip, setNip] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    getCompanySettings()
      .then((data: Record<string, unknown>) => {
        if (data.id) setSettingsId(String(data.id));
        setCompanyName(String(data.companyName ?? ""));
        setNip(String(data.nip ?? ""));
        setEmail(String(data.email ?? ""));
        setPhone(String(data.phone ?? ""));
        setAddress(String(data.address ?? ""));
        setBankAccount(String(data.bankAccount ?? ""));
        setLogoUrl(data.logoUrl != null ? String(data.logoUrl) : null);
        setFaviconUrl(data.faviconUrl != null ? String(data.faviconUrl) : null);
        setPrivacyPolicyUrl(String(data.privacyPolicyUrl ?? ""));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const removeLogo = (type: "logo" | "favicon") => {
    if (type === "logo") setLogoUrl(null);
    else setFaviconUrl(null);
    toast.success(type === "logo" ? "Logo usunięte" : "Favicon usunięty");
  };

  const uploadCompanyAsset = async (type: "logo" | "favicon", file: File) => {
    if (type === "logo") setUploadingLogo(true);
    else setUploadingFavicon(true);
    try {
      const uploaded = await uploadAdminImage(file, "company");
      if (type === "logo") setLogoUrl(uploaded.url);
      else setFaviconUrl(uploaded.url);
      toast.success(type === "logo" ? "Logo przesłane" : "Favicon przesłany");
    } catch (err: unknown) {
      toast.error("Błąd uploadu: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      if (type === "logo") setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCompanySettings({
        companyName,
        nip,
        email,
        phone,
        address,
        bankAccount,
        logoUrl: logoUrl || null,
        faviconUrl: faviconUrl || null,
        privacyPolicyUrl: privacyPolicyUrl || null,
      });
      toast.success("Dane firmy zapisane");
    } catch (err: unknown) {
      toast.error("Błąd zapisu: " + (err instanceof Error ? err.message : String(err)));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dane firmy</h1>
        <p className="text-muted-foreground text-sm">Podstawowe informacje o firmie</p>
      </div>

      <div className="space-y-6">
        {/* Logos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Logo firmy</CardTitle>
            <CardDescription>Logo główne i favicon — wyświetlane na dokumentach i w panelu</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Main logo */}
              <div className="space-y-3">
                <Label>Logo główne</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[140px] relative">
                  {logoUrl ? (
                    <>
                      <img src={logoUrl} alt="Logo" className="max-h-24 max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeLogo("logo")}
                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Image className="w-10 h-10" />
                      <span className="text-xs">Wybierz plik logo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadCompanyAsset("logo", file);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploadingLogo ? "Przesyłanie..." : "Prześlij logo"}
                </Button>
              </div>

              {/* Favicon */}
              <div className="space-y-3">
                <Label>Favicon</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-[140px] relative">
                  {faviconUrl ? (
                    <>
                      <img src={faviconUrl} alt="Favicon" className="max-h-16 max-w-16 object-contain" />
                      <button
                        type="button"
                        onClick={() => removeLogo("favicon")}
                        className="absolute top-2 right-2 p-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Image className="w-10 h-10" />
                      <span className="text-xs">Wybierz plik favicon</span>
                    </div>
                  )}
                </div>
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void uploadCompanyAsset("favicon", file);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                  {uploadingFavicon ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                  {uploadingFavicon ? "Przesyłanie..." : "Prześlij favicon"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informacje ogólne</CardTitle>
            <CardDescription>Dane rejestrowe i kontaktowe firmy</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nazwa firmy</Label>
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nip">NIP</Label>
                <Input id="nip" value={nip} onChange={(e) => setNip(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccount">Numer konta bankowego</Label>
              <Input id="bankAccount" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="privacyPolicy">Link do regulaminu / polityki prywatności</Label>
              <Input id="privacyPolicy" placeholder="https://example.com/regulamin" value={privacyPolicyUrl} onChange={(e) => setPrivacyPolicyUrl(e.target.value)} />
              <p className="text-xs text-muted-foreground">Wyświetlany w formularzu zamówienia do akceptacji</p>
            </div>
          </CardContent>
        </Card>

        <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving}>
          {saving ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
      </div>
    </div>
  );
};

export default SettingsCompanyView;
