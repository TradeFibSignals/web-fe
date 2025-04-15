import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Footer } from "@/components/footer"
import { HeaderNav } from "@/components/header-nav"

export const metadata = {
  title: "Trading Disclaimer - BTC Market Today",
  description: "Trading Disclaimer for the BTC Market Today platform",
}

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-[#1a1f2e] flex flex-col">
      <HeaderNav />
      <div className="container mx-auto px-4 py-8 flex-grow">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-6">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-6">Trading Disclaimer</h1>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-lg text-muted-foreground mb-6">Last updated: {new Date().toLocaleDateString()}</p>

          <div className="bg-yellow-900/20 border border-yellow-700/50 p-4 rounded-md mb-8">
            <h2 className="text-yellow-500 mt-0">IMPORTANT NOTICE</h2>
            <p className="mb-0">
              The information provided on BTC Market Today is for general informational purposes only. All information
              on the platform is provided in good faith, however, we make no representation or warranty of any kind,
              express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness
              of any information on the platform.
            </p>
          </div>

          <h2>1. Not Financial Advice</h2>
          <p>
            The content on BTC Market Today is not intended to be and does not constitute financial advice, investment
            advice, trading advice, or any other advice. The information on this platform is general in nature and is
            not specific to you or anyone else. You should not make any decision, financial, investment, trading or
            otherwise, based on any of the information presented on this platform without undertaking independent due
            diligence and consultation with a professional financial advisor.
          </p>

          <h2>2. Trading Risks</h2>
          <p>
            Trading cryptocurrencies involves substantial risk and is not suitable for all investors. The high degree of
            leverage can work against you as well as for you. Before deciding to trade cryptocurrencies, you should
            carefully consider your investment objectives, level of experience, and risk appetite. The possibility
            exists that you could sustain a loss of some or all of your initial investment and therefore you should not
            invest money that you cannot afford to lose.
          </p>

          <h2>3. Liquidation Data and Trading Signals</h2>
          <p>The liquidation data, trading signals, and other market indicators displayed on BTC Market Today are:</p>
          <ul>
            <li>Based on historical data and algorithmic analysis</li>
            <li>Not guaranteed to be accurate or timely</li>
            <li>Not predictive of future market movements</li>
            <li>Provided for informational purposes only</li>
            <li>Subject to change without notice</li>
          </ul>

          <h2>4. Past Performance</h2>
          <p>
            Past performance is not indicative of future results. The value of cryptocurrencies can go down as well as
            up. Users are advised to research and verify any information obtained from this platform and to consult with
            qualified professionals before making any investment decisions.
          </p>

          <h2>5. Third-Party Links</h2>
          <p>
            BTC Market Today may provide links to external websites or resources. These links are provided for your
            convenience only. We have no control over the contents of those sites or resources, and accept no
            responsibility for them or for any loss or damage that may arise from your use of them.
          </p>

          <h2>6. Market Data</h2>
          <p>
            While we strive to use reliable sources for market data, we cannot guarantee the accuracy, timeliness, or
            completeness of the data displayed on our platform. Market data may be delayed, and users should verify
            information with other sources before making trading decisions.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            In no event shall BTC Market Today, its operators, owners, or contributors be liable for any direct,
            indirect, incidental, special, exemplary, or consequential damages (including, but not limited to,
            procurement of substitute goods or services; loss of use, data, or profits; or business interruption)
            arising in any way out of the use of this platform, even if advised of the possibility of such damage.
          </p>

          <h2>8. User Responsibility</h2>
          <p>
            By using BTC Market Today, you acknowledge and agree that you are solely responsible for your trading
            decisions and that you will not hold BTC Market Today or any of its affiliates responsible for any losses
            you may incur as a result of your trading activities.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
