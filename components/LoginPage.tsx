import React, { useState } from 'react';
import { Eye, EyeOff, Globe } from 'lucide-react';

interface LoginPageProps {
  onLogin: (status: boolean) => void;
}

const AuthTopBar: React.FC = () => (
  <div className="flex items-center justify-between mb-16" dir="ltr">
    <h1 className="text-3xl md:text-4xl 2xl:text-[56px] leading-none tracking-[-0.06em] font-semibold text-[#4c4c53] select-none">
      <span className="text-[#4f4f56]">kl</span>
      <span className="text-[#6b23db]">i</span>
      <span className="text-[#4f4f56]">ck</span>
      <span className="text-[#6b23db]">i</span>
      <span className="text-[#4f4f56]">t</span>
    </h1>
    <button
      type="button"
      className="inline-flex items-center gap-2 text-sm md:text-base 2xl:text-[24px] font-medium text-[#66666e] hover:text-[#5e1bd4] transition-colors"
    >
      <span>EN</span>
      <Globe className="h-5 w-5 md:h-6 md:w-6" />
    </button>
  </div>
);

const AuthSidePanel: React.FC = () => (
  <div className="hidden xl:flex xl:w-[44%] relative overflow-hidden bg-[#efedf4]">
    <div className="absolute top-[-20%] right-[-10%] h-[64%] w-[76%] rotate-45 bg-white/30"></div>
    <div className="absolute top-[18%] right-[18%] h-[54%] w-[54%] rotate-45 bg-white/25"></div>
    <div
      className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-b from-[#6b13d7] to-[#5600bd]"
      style={{ clipPath: 'polygon(0 22%, 100% 56%, 100% 100%, 0% 100%)' }}
    ></div>

    <div className="relative z-10 w-full h-full flex flex-col justify-between px-12 py-12">
      <div className="text-center text-[#8e8f96] font-bold italic leading-[1.4] tracking-wide">
        <p className="text-[24px] 2xl:text-[42px] xl:text-[30px] whitespace-nowrap">Managing your payments is</p>
        <p className="text-[24px] 2xl:text-[42px] xl:text-[30px] whitespace-nowrap mt-1">
          .one <span className="text-[#5e12d3]">Klick</span> away
        </p>
      </div>

      <div className="relative flex justify-center mb-14">
        <div className="relative w-[392px] h-[240px] 2xl:w-[520px] 2xl:h-[316px] rounded-[50px] bg-black p-[9px] shadow-[0_14px_26px_rgba(0,0,0,0.33)]">
          <div className="relative h-full w-full rounded-[42px] bg-[#0f1016] p-[9px]">
            <span className="absolute top-[6px] left-1/2 -translate-x-1/2 h-[4px] w-[4px] rounded-full bg-[#717381]"></span>

            <div className="h-full w-full rounded-[31px] bg-[#dcdbe5] px-3.5 py-3 2xl:px-5 2xl:py-4">
              <div className="h-[58%] flex gap-3">
                <div className="flex-1 rounded-[8px] bg-[#f7f7fa] shadow-[0_3px_10px_rgba(44,44,60,0.14)] px-3 py-2">
                  <div className="flex justify-center gap-10 pb-2">
                    <span className="h-2 w-2 rounded-[2px] bg-[#6222e0]"></span>
                    <span className="h-2 w-2 rounded-[2px] bg-[#f48f2b]"></span>
                    <span className="h-2 w-2 rounded-[2px] bg-[#f2c237]"></span>
                    <span className="h-2 w-2 rounded-[2px] bg-[#a9b1f4]"></span>
                  </div>

                  <div className="flex h-[75%] items-end justify-between px-1">
                    {[65, 49, 72, 31, 58, 46, 63, 69, 52, 37, 66, 54, 62, 33].map((h, i) => (
                      <div key={i} className="relative h-full w-[6px] bg-[#ececf3] rounded-full overflow-hidden">
                        <span
                          style={{ height: `${h}%` }}
                          className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full ${
                            i % 4 === 0
                              ? 'bg-[#6222e0]'
                              : i % 4 === 1
                              ? 'bg-[#a9b1f4]'
                              : i % 4 === 2
                              ? 'bg-[#f48f2b]'
                              : 'bg-[#f2c237]'
                          }`}
                        ></span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-1 flex justify-between px-1">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span key={i} className="text-[6px] text-[#c5c5d0]">
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="w-[35%] flex flex-col gap-2">
                  {[
                    ['#f2c237', '28%', '3.4 K'],
                    ['#f48f2b', '61%', '5.1 K'],
                    ['#6222e0', '94%', '78.7 K'],
                  ].map((card, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-[8px] bg-[#f7f7fa] shadow-[0_3px_10px_rgba(44,44,60,0.14)] px-2.5 py-2 flex items-center justify-between"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f0ad2e]"></span>
                      <div className="h-7 w-7 rounded-full border-[4px] relative" style={{ borderColor: card[0], borderRightColor: '#ececf3' }}>
                        <span className="absolute inset-0 flex items-center justify-center text-[7px] font-semibold text-[#8f909e]">{card[1]}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="h-2 w-2 rounded-full border border-[#d2d2dd]"></span>
                        <span className="mt-1 text-[9px] text-[#a0a1ad] font-semibold">{card[2]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 h-[38%] rounded-[8px] bg-[#f7f7fa] shadow-[0_3px_10px_rgba(44,44,60,0.14)] px-5 py-2.5">
                <div className="flex justify-center gap-6 pb-2 text-[6px] text-[#c0c1cc]">
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#6222e0]"></i>Lorem ipsum</span>
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#f48f2b]"></i>Lorem ipsum</span>
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#f2c237]"></i>Lorem ipsum</span>
                  <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[#a9b1f4]"></i>Lorem ipsum</span>
                </div>
                <div className="flex h-[72%] items-end gap-2">
                  {[18, 34, 15, 25, 45, 16, 29, 18, 25, 35, 13, 21, 19, 33, 29, 16].map((h, i) => (
                    <span
                      key={i}
                      style={{ height: `${h}%` }}
                      className={`w-full rounded-t-[4px] ${
                        i % 4 === 0
                          ? 'bg-[#6222e0]'
                          : i % 4 === 1
                          ? 'bg-[#d7d7e2]'
                          : i % 4 === 2
                          ? 'bg-[#f48f2b]'
                          : 'bg-[#a9b1f4]'
                      }`}
                    ></span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-4 h-4 w-[448px] 2xl:w-[596px] rounded-b-[16px] bg-[#9ea0ac] shadow-[0_12px_18px_rgba(0,0,0,0.28)]"></div>
        <div className="absolute -bottom-[2px] h-2 w-20 rounded-b-full bg-[#5f6170]"></div>
      </div>

      <p className="text-center text-[18px] 2xl:text-[32px] xl:text-[23px] font-semibold text-white mb-4 tracking-wide">
        ! Welcome to <span className="font-bold">Klickit's</span> dashboard
      </p>
    </div>
  </div>
);

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === 'taleem@alfardoos.com' && password === '123456') {
      onLogin(true);
      return;
    }
    setError('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  if (isForgotPassword) {
    return (
      <div className="min-h-screen w-full bg-[#f5f5f8] flex overflow-hidden" dir="ltr">
        <AuthSidePanel />

        <div className="w-full xl:w-[56%] flex justify-center" dir="rtl">
          <div className="w-full max-w-[980px] px-8 md:px-14 2xl:px-20 pt-12 pb-10">
            <AuthTopBar />

            <form onSubmit={handleForgotPasswordSubmit} className="max-w-[760px] mx-auto mt-8 md:mt-14">
              <div className="group">
                <label className="block text-base md:text-lg 2xl:text-[28px] text-[#6f6f76] font-semibold mb-6 group-focus-within:text-[#5f13d6] transition-colors">
                  من فضلك ادخل بريدك الإلكتروني او رقم الموبايل *
                </label>
                <input
                  type="text"
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  className="w-full bg-transparent border-b-[2px] border-[#cfcfd6] pb-4 text-lg md:text-xl 2xl:text-[24px] text-[#55555d] focus:outline-none focus:border-[#6c24dc] transition-colors"
                  dir="ltr"
                  required
                />
              </div>

              <button
                type="submit"
                className="mt-16 md:mt-20 w-full rounded-full text-white text-lg md:text-xl 2xl:text-[28px] font-bold py-4 md:py-5 bg-gradient-to-r from-[#7a39eb] to-[#7f3af0] hover:from-[#6f2de3] hover:to-[#7430e6] transition-all shadow-[0_20px_35px_-25px_rgba(102,46,207,0.8)]"
              >
                ارسال الكود
              </button>

              <div className="mt-14 text-right">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-base md:text-lg 2xl:text-[24px] font-medium text-[#5f6068]"
                >
                  أعدني إلى <span className="text-[#6b23db]">تسجيل دخول</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f5f8] flex overflow-hidden" dir="ltr">
      <AuthSidePanel />

      <div className="w-full xl:w-[56%] flex justify-center" dir="rtl">
        <div className="w-full max-w-[980px] px-8 md:px-14 2xl:px-20 pt-12 pb-10">
          <AuthTopBar />

          <div className="max-w-[760px] mx-auto mt-8">
            <h2 className="text-2xl md:text-3xl 2xl:text-[40px] leading-[1.55] text-[#606066] font-bold text-center mb-14">
              من فضلك قم بتسجيل الدخول للإستمرار
            </h2>

            <form onSubmit={handleLogin} className="space-y-10">
              <div className="group">
                <label className="block text-base md:text-lg 2xl:text-[28px] text-[#7f7f86] font-semibold mb-5 group-focus-within:text-[#5f13d6] transition-colors">
                  البريد الإلكتروني او رقم الهاتف *
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent border-b-[2px] border-[#cfcfd6] pb-4 text-lg md:text-xl 2xl:text-[24px] text-[#55555d] focus:outline-none focus:border-[#6c24dc] transition-colors"
                  dir="ltr"
                />
              </div>

              <div className="group">
                <label className="block text-base md:text-lg 2xl:text-[28px] text-[#7f7f86] font-semibold mb-5 group-focus-within:text-[#5f13d6] transition-colors">
                  كلمه السر *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent border-b-[2px] border-[#cfcfd6] pb-4 pl-10 text-lg md:text-xl 2xl:text-[24px] text-[#55555d] focus:outline-none focus:border-[#6c24dc] transition-colors"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute left-0 top-0 text-[#8a8a92] hover:text-[#6322d8] transition-colors"
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? <EyeOff className="w-6 h-6 md:w-8 md:h-8" /> : <Eye className="w-6 h-6 md:w-8 md:h-8" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm md:text-base 2xl:text-[24px] font-semibold">{error}</p>}

              <div className="pt-3">
                <div className="flex justify-end mb-12">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError('');
                    }}
                    className="text-base md:text-lg 2xl:text-[24px] font-medium text-[#6d2dde] hover:text-[#5215c6] transition-colors"
                  >
                    نسيت كلمة المرور؟
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full text-white text-lg md:text-xl 2xl:text-[28px] font-bold py-4 md:py-5 bg-gradient-to-r from-[#7a39eb] to-[#7f3af0] hover:from-[#6f2de3] hover:to-[#7430e6] transition-all shadow-[0_20px_35px_-25px_rgba(102,46,207,0.8)]"
                >
                  تسجيل دخول
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
