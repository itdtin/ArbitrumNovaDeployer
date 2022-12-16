// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract CryptoSchool_2 {
    address public owner;
    mapping(address => uint256) public payments;
    bytes32 internal constant _STRATEGY_SLOT = 0xf1a169aa0f736c2813818fdfbdc5755c31e0839c8f49831a16543496b28574ea;

    constructor() {
        owner = msg.sender;
    }

    function dep() public payable {
        payments[msg.sender] = msg.value;
    }

    function MoneyBack() public {
        address payable _to = payable(owner);
        address _thisContract = address(this);
        _to.transfer(_thisContract.balance);
    }

    receive() external payable {}
}
