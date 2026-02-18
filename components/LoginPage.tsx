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
      <div className="min-h-screen w-full bg-[#f5f5f8] flex justify-center" dir="rtl">
        <div className="w-full max-w-[1120px] px-8 md:px-14 2xl:px-20 pt-12 pb-10">
          <AuthTopBar />

          <form onSubmit={handleForgotPasswordSubmit} className="max-w-[980px] mx-auto mt-28 md:mt-36">
            <div className="group">
              <label className="block text-base md:text-2xl 2xl:text-[38px] text-[#696971] font-semibold mb-6 md:mb-8 group-focus-within:text-[#5f13d6] transition-colors">
                من فضلك ادخل بريدك الإلكتروني او رقم الموبايل *
              </label>
              <input
                type="text"
                value={recoveryIdentifier}
                onChange={(e) => setRecoveryIdentifier(e.target.value)}
                className="w-full bg-transparent border-b-[2px] border-[#cfcfd6] pb-4 md:pb-5 text-lg md:text-xl 2xl:text-[26px] text-[#55555d] focus:outline-none focus:border-[#6c24dc] transition-colors"
                dir="ltr"
                required
              />
            </div>

            <button
              type="submit"
              className="mt-20 md:mt-24 w-full rounded-full text-white text-lg md:text-xl 2xl:text-[28px] font-bold py-4 md:py-5 bg-gradient-to-r from-[#7a39eb] to-[#7f3af0] hover:from-[#6f2de3] hover:to-[#7430e6] transition-all shadow-[0_20px_35px_-25px_rgba(102,46,207,0.8)]"
            >
              ارسال الكود
            </button>

            <div className="mt-16 text-right">
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="text-xl md:text-3xl 2xl:text-[44px] font-medium text-[#5f6068]"
              >
                أعدني إلى <span className="text-[#6b23db]">تسجيل دخول</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#f5f5f8] flex overflow-hidden" dir="ltr">
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
            <div className="relative w-[360px] h-[215px] 2xl:w-[500px] 2xl:h-[300px] rounded-[30px] border-[8px] border-black bg-[#e8e8ed] p-3.5 shadow-2xl overflow-hidden">
              <div className="h-[56%] rounded-[10px] bg-white shadow-sm p-4 flex gap-4">
                <div className="flex-1 rounded-[8px] bg-[#f6f6f8] p-3 flex items-end gap-2">
                  {[56, 72, 46, 82, 44, 68, 50, 76, 58, 67].map((h, index) => (
                    <span
                      key={index}
                      style={{ height: `${h}%` }}
                      className={`w-full rounded-t ${
                        index % 3 === 0 ? 'bg-[#6a25d9]' : index % 3 === 1 ? 'bg-[#f7c442]' : 'bg-[#8c94f3]'
                      }`}
                    ></span>
                  ))}
                </div>
                <div className="w-[34%] space-y-3">
                  {[['#f7bb42', '35%'], ['#ef8f2c', '52%'], ['#6a25d9', '65%']].map((card, index) => (
                    <div key={index} className="rounded-[8px] bg-[#f9f9fb] shadow-sm px-3 py-2 flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-full border-[3px]"
                        style={{ borderColor: card[0], borderRightColor: '#eee' }}
                      ></div>
                      <div className="flex-1">
                        <div className="h-1.5 w-10 rounded bg-[#e2e2ea]"></div>
                      </div>
                      <span className="text-[10px] text-[#aeafba]">{card[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 h-[34%] rounded-[10px] bg-white shadow-sm p-4 flex items-end gap-2">
                {[22, 48, 30, 58, 33, 51, 26, 46, 40, 60, 34, 43].map((h, index) => (
                  <span
                    key={index}
                    style={{ height: `${h}%` }}
                    className={`w-full rounded-t ${
                      index % 4 === 0
                        ? 'bg-[#6a25d9]'
                        : index % 4 === 1
                        ? 'bg-[#d8d8e2]'
                        : index % 4 === 2
                        ? 'bg-[#f69527]'
                        : 'bg-[#9ea4f0]'
                    }`}
                  ></span>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-4 h-4 w-[450px] 2xl:w-[620px] rounded-b-[14px] bg-[#94949e] shadow-xl"></div>
          </div>

          <p className="text-center text-[18px] 2xl:text-[32px] xl:text-[23px] font-semibold text-white mb-4 tracking-wide">
            ! Welcome to <span className="font-bold">Klickit's</span> dashboard
          </p>
        </div>
      </div>

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
