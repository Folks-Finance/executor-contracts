from algopy import Account, Bytes, Global, GlobalState, String, Txn, UInt64, itxn, gtxn, op
from algopy.arc4 import Address, UInt16, abi_call, abimethod, emit

from folks_contracts.library import BytesUtils
from ...types import ARC4UInt64, Bytes32
from .interfaces.IExecutor import IExecutor
from .interfaces.ITokenPaymentExecutor import CUSTOM_TOKEN_FEE_PREFIX, ITokenPaymentExecutor, PaymentInToken

# Constants
EXECUTOR_VERSION = "TokenPaymentExecutor-0.0.1"


class TokenPaymentExecutor(ITokenPaymentExecutor):
    def __init__(self) -> None:
        self.executor_version = String(EXECUTOR_VERSION)
        self.executor = GlobalState(UInt64)

    @abimethod(create="require")
    def create(self, executor: UInt64) -> None:
        self.executor.value = executor

    @abimethod
    def whitelist_token_for_payment(self, asset_id: UInt64) -> None:
        # ALGO min balance implicitly required
        itxn.AssetTransfer(
            xfer_asset=asset_id,
            asset_receiver=Global.current_application_address,
            asset_amount=0,
            fee=0,
        ).submit()

    @abimethod
    def request_execution_with_token_payment(
        self,
        fee_payment: gtxn.AssetTransferTransaction,
        dst_chain: UInt16,
        dst_addr: Bytes32,
        refund_addr: Address,
        signed_quote_bytes: Bytes,
        request_bytes: Bytes,
        relay_instructions: Bytes,
    ) -> None:
        prefix = op.extract(signed_quote_bytes, 0, 4)
        assert prefix == CUSTOM_TOKEN_FEE_PREFIX, "Prefix mismatch"

        universal_payee_address = op.extract(signed_quote_bytes, 24, 32)
        universal_token_address = Bytes32.from_bytes(op.extract(signed_quote_bytes, 100, 32))

        # forward payment to payee, amount is not checked
        asset_id = BytesUtils.safe_convert_bytes32_to_uint64(universal_token_address)
        assert fee_payment.sender == Txn.sender, "Fee txn must be from same sender"
        assert fee_payment.asset_receiver == Global.current_application_address, "Unknown fee payment receiver"
        assert fee_payment.xfer_asset.id == asset_id, "Unknown asset id"
        itxn.AssetTransfer(
            xfer_asset=asset_id,
            asset_receiver=Account(universal_payee_address),
            asset_amount=fee_payment.asset_amount,
            fee=0,
        ).submit()

        emit(PaymentInToken(ARC4UInt64(asset_id), ARC4UInt64(fee_payment.asset_amount)))

        # zero algo payment used because token payment covers entire cost
        executor_address, exists = op.AppParamsGet.app_address(self.executor.value)
        assert exists, "Executor address unknown"
        abi_call(
            IExecutor.request_execution,
            itxn.Payment(amount=0, receiver=executor_address, fee=0),
            dst_chain,
            dst_addr,
            refund_addr,
            signed_quote_bytes,
            request_bytes,
            relay_instructions,
            app_id=self.executor.value,
            fee=0
        )
