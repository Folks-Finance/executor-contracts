from algopy import Global, GlobalState, UInt64, gtxn, itxn, op
from algopy.arc4 import Bool, Struct, UInt8, UInt16, abimethod, emit

from ntt_contracts.ntt_manager.interfaces.INttManager import INttManager, NttManagerPeer
from ntt_contracts.types import TransceiverInstructions
from ....types import ARC4UInt16, Bytes32


# Events
class Transfer(Struct):
    succeeds: Bool

class GetNttManagerPeer(Struct):
    chain_id: ARC4UInt16


class MockNttManager(INttManager):
    def __init__(self) -> None:
        self.ntt_manager_peer = GlobalState(NttManagerPeer)
        self.message_id = GlobalState(Bytes32)

    @abimethod
    def whitelist_token_for_transfer(self, asset_id: UInt64) -> None:
        # ALGO min balance implicitly required
        itxn.AssetTransfer(
            xfer_asset=asset_id,
            asset_receiver=Global.current_application_address,
            asset_amount=0,
            fee=0,
        ).submit()

    @abimethod
    def set_ntt_manager_peer(self, peer_contract: Bytes32, decimals: UInt8) -> None:
        self.ntt_manager_peer.value = NttManagerPeer(peer_contract.copy(), decimals)

    @abimethod
    def set_message_id(self, message_id: Bytes32) -> None:
        self.message_id.value = message_id.copy()

    @abimethod
    def transfer(
        self,
        fee_payment: gtxn.PaymentTransaction,
        send_token: gtxn.AssetTransferTransaction,
        amount: UInt64,
        recipient_chain: UInt16,
        recipient: Bytes32
    ) -> Bytes32:
        emit(Transfer(Bool(True)))
        return self.message_id.value

    @abimethod
    def transfer_full(
        self,
        fee_payment: gtxn.PaymentTransaction,
        send_token: gtxn.AssetTransferTransaction,
        amount: UInt64,
        recipient_chain: UInt16,
        recipient: Bytes32,
        should_queue: Bool,
        transceiver_instructions: TransceiverInstructions,
    ) -> Bytes32:
        emit(Transfer(Bool(True)))
        return self.message_id.value

    # incorrect method signature
    @abimethod
    def complete_outbound_queued_transfer(self, fee_payment: gtxn.PaymentTransaction, message_id: Bytes32) -> Bytes32:
        return self.message_id.value

    @abimethod
    def cancel_outbound_queued_transfer(self, message_id: Bytes32) -> None:
        pass

    @abimethod
    def complete_inbound_queued_transfer(self, message_digest: Bytes32) -> None:
        pass

    @abimethod(readonly=True)
    def get_ntt_manager_peer(self, chain_id: UInt16) -> NttManagerPeer:
        emit(GetNttManagerPeer(chain_id))
        return self.ntt_manager_peer.value
